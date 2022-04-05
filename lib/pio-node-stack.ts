import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam'
import * as path from 'path';
import { KeyPair } from 'cdk-ec2-key-pair';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { Construct } from 'constructs';


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

    // Create a Key Pair to be used with this EC2 Instance
    // Temporarily disabled since `cdk-ec2-key-pair` is not yet CDK v2 compatible
    const key = new KeyPair(this, 'KeyPair', {
      name: keyPairName,
      description: 'Key Pair created with CDK Deployment',
    });
    key.grantReadOnPublicKey

    // Create new VPC with 2 Subnets
    const vpc = new ec2.Vpc(this, 'VPC', {
      natGateways: 0,
      subnetConfiguration: [{
        cidrMask: 24,
        name: "asterisk",
        subnetType: ec2.SubnetType.PUBLIC
      }]
    });

    // Allow SSH (TCP Port 22) access from anywhere
    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Allow SSH (TCP port 22) in',
      allowAllOutbound: true
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH Access')

    const role = new iam.Role(this, 'ec2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    })

    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))

    // Use Latest Amazon Linux Image - CPU Type ARM64
    const ami = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      cpuType: ec2.AmazonLinuxCpuType.X86_64
    });

    // Create the instance using the Security Group, AMI, and KeyPair defined in the VPC created
    const ec2Instance = new ec2.Instance(this, 'Instance', {
      instanceName: props?.instanceName ? props.instanceName : "pio-node",
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: ami,
      securityGroup: securityGroup,
      keyName: key.keyPairName,
      role: role
    });

    // Create an asset that will be used as part of User Data to run on first load
    const asset = new Asset(this, 'Asset', { path: path.join(__dirname, '../src/config.sh') });
    const localPath = ec2Instance.userData.addS3DownloadCommand({
      bucket: asset.bucket,
      bucketKey: asset.s3ObjectKey
    });

    // Create file arguments
    const args: string = buildArgsString(props); 
    ec2Instance.userData.addExecuteFileCommand({
      filePath: localPath,
      arguments: `--verbose -y ${args}` 
    });
    asset.grantRead(ec2Instance.role);

    // Create outputs for connecting
    new cdk.CfnOutput(this, 'Built with arguemnts', { value: args });
    new cdk.CfnOutput(this, 'IP Address', { value: ec2Instance.instancePublicIp });
    new cdk.CfnOutput(this, 'Key Name', { value: key.keyPairName });
    new cdk.CfnOutput(this, 'Download Key Command', { value: `aws secretsmanager get-secret-value --secret-id ec2-ssh-key/${keyPairName}/private --query SecretString --output text > ${keyPairName}.pem && chmod 400 ${keyPairName}.pem` })
    new cdk.CfnOutput(this, 'ssh command', { value: `ssh -i ${keyPairName}.pem -o IdentitiesOnly=yes ec2-user@${ec2Instance.instancePublicIp}` })
  }
}

function buildArgsString(props?: PioNodeProps): string {
  var args: string = "";

  if (props?.chainId != undefined) {
    args = args + ` --chain-id ${props.chainId}`
  }
  if (props?.chainVersion != undefined) {
    args = args + ` --chain-version ${props.chainVersion}`
  }
  if (props?.goVersion != undefined) {
    args = args + ` --go-version ${props.goVersion}`
  }
  if (props?.nodeMoniker != undefined) {
    args = args + ` --moniker ${props.nodeMoniker}`
  }
  if (props?.provenanceUrl != undefined) {
    args = args + ` --prov-url ${props.provenanceUrl}`
  }

  return args
}