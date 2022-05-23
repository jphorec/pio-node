import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam'
import * as path from 'path';
import { KeyPair } from 'cdk-ec2-key-pair';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { Construct } from 'constructs';
import { Size } from "aws-cdk-lib";
import { type } from "os";
import internal = require("events");


export interface PioNodeProps extends cdk.StackProps {
  nodeMoniker: string,
  provenanceUrl?: string,
  chainVersion?: string,
  goVersion?: string,
  chainId?: string,
  instanceName?: string
}

export class PioNodeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: PioNodeProps) {
    super(scope, id, props);

    const keyPairName: string = 'pio-key'
  //  const tmkmsKeyName: string = 'tmkms-key'

    // Create a Key Pair to be used with this EC2 Instance
    // Temporarily disabled since `cdk-ec2-key-pair` is not yet CDK v2 compatible
    const key = new KeyPair(this, 'KeyPair', {
      name: keyPairName,
      description: 'Key Pair created with CDK Deployment',
    });
    key.grantReadOnPublicKey
/*
    const tmkmsKey = new KeyPair(this, 'TMKMS-KeyPair', {
      name: tmkmsKeyName, 
      description: 'Tmkms key pair'
    })
*/
    // Create new VPC with 2 Subnets
    const vpc = new ec2.Vpc(this, 'VPC', {
      cidr: '10.0.0.0/16',
      natGateways: 1,
      maxAzs: 3,
      subnetConfiguration: [
        {
          name: 'private-subnet-1',
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
          cidrMask: 24,
        },
        {
          name: 'public-subnet-1',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        }]
    });

    // Allow SSH (TCP Port 22) access from anywhere
    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Allow SSH (TCP port 22) in',
      allowAllOutbound: true
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH Access')
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(26657), 'rpc port')
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(9090), 'grpc port')
/*
    const tmkmsSecurityGroup = new ec2.SecurityGroup(this, 'internal ssh', {
      vpc,
      description: 'Allow SSH internally',
      allowAllOutbound: false
    })

    tmkmsSecurityGroup.addEgressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(22), 'Internal ssh egress')
    tmkmsSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(22), 'intenral ssh ingress')

*/
    const role = new iam.Role(this, 'ec2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    })

    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))

    // Use Latest Amazon Linux Image - CPU Type ARM64
    const ami = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      cpuType: ec2.AmazonLinuxCpuType.X86_64
    });
/*
    const tmkmsAmi = new ec2.GenericLinuxImage({
      'us-east-1': 'provenance-io-tmkms-1650940834',
      'us-east-2': 'provenance-io-tmkms-1650940834',
      'us-west-1': 'provenance-io-tmkms-1650940834',
      'us-west-2': 'provenance-io-tmkms-1650940834'
    });
*/
    const rootVolume: ec2.BlockDevice = {
      deviceName: '/dev/xvda', 
      volume: ec2.BlockDeviceVolume.ebs(800), // Override the volume size in Gibibytes (GiB)
    };
/*
    const tmkmsVolume: ec2.BlockDevice = {
      deviceName: '/dev/xvda', 
      volume: ec2.BlockDeviceVolume.ebs(800), // Override the volume size in Gibibytes (GiB)
    };
*/
    // Create the instance using the Security Group, AMI, and KeyPair defined in the VPC created
    const pioInstance = new ec2.Instance(this, 'pio node', {
      instanceName: props?.instanceName ? props.instanceName : "pio-node",
      vpc,
      vpcSubnets: vpc.selectSubnets({subnetType: ec2.SubnetType.PUBLIC}),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
      machineImage: ami,
      securityGroup: securityGroup,
      keyName: key.keyPairName,
      detailedMonitoring: true,
      role: role,
      blockDevices: [rootVolume]
    });
/*
    const enclaveOptionsProperty: ec2.CfnInstance.EnclaveOptionsProperty = {
      enabled: true,
    };

    const tmkmsInstance = new ec2.Instance(this, 'tmkms node', {
      instanceName: 'tmkms-node', 
      vpc: vpc,
      vpcSubnets: vpc.selectSubnets({subnetType: ec2.SubnetType.PRIVATE_WITH_NAT}),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
      machineImage: tmkmsAmi,
      securityGroup: tmkmsSecurityGroup,
      keyName: tmkmsKey.keyPairName,
      detailedMonitoring: true,
      role: role,
      blockDevices: [tmkmsVolume],
    })
*/
    // Create an asset that will be used as part of User Data to run on first load
    const asset = new Asset(this, 'Asset', { path: path.join(__dirname, '../src/config.sh') });
    const localPath = pioInstance.userData.addS3DownloadCommand({
      bucket: asset.bucket,
      bucketKey: asset.s3ObjectKey
    });

    // Create file arguments
    const args: string = buildArgsString(props); 
    pioInstance.userData.addExecuteFileCommand({
      filePath: localPath,
      arguments: `--verbose -y ${args}` 
    });
    asset.grantRead(pioInstance.role);

    // Create outputs for connecting
    new cdk.CfnOutput(this, 'Built with arguemnts', { value: args });
    new cdk.CfnOutput(this, 'IP Address', { value: pioInstance.instancePublicIp });
    new cdk.CfnOutput(this, 'Key Name', { value: key.keyPairName });
    new cdk.CfnOutput(this, 'Download Key Command', { value: `aws secretsmanager get-secret-value --secret-id ec2-ssh-key/${keyPairName}/private --query SecretString --output text > ${keyPairName}.pem && chmod 400 ${keyPairName}.pem` })
    new cdk.CfnOutput(this, 'ssh command', { value: `ssh -i ${keyPairName}.pem -o IdentitiesOnly=yes ec2-user@${pioInstance.instancePublicIp}` })

    //new cdk.CfnOutput(this, 'tmkms ip address', { value: tmkmsInstance.instancePrivateIp });
  }
}

function buildArgsString(props?: PioNodeProps): string {
  var args: string = "";

  if (props?.chainId != undefined) {
    args = args + ` -c ${props.chainId}`
  }
  if (props?.chainVersion != undefined) {
    args = args + ` -v ${props.chainVersion}`
  }
  if (props?.goVersion != undefined) {
    args = args + ` -g ${props.goVersion}`
  }
  if (props?.nodeMoniker != undefined) {
    args = args + ` -m ${props.nodeMoniker}`
  }
  if (props?.provenanceUrl != undefined) {
    args = args + ` -p ${props.provenanceUrl}`
  }

  return args
}