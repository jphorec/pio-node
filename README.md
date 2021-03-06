# Welcome to the pio-node AWS CDK construct

This CDK application stands up an AWS EC2 instance with an 800GB volume. 

This instance is provisioned to build a full [provenance](https://provenance.io) blockchain node and downloads a [quicksync](https://provenance.io/quicksync) snapshot to speed up the node instantiation process. 

Eventually this project will also include the ability to turn the node into a validator. 

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## Infrastructure

Currently this app creates an m5.large EC2 instance with 800GB of data. Only port 22 is exposed on the server out of the box.

If wanting to expose the rpc or grpc ports you will need to update the security groups inbound rules. 

A load balancer is currently being worked on to be added to safely expose all needed service mesh ports (AWS provides ddos protection for free over their load balancers)

## Getting started

Install aws command line tool from this guide: 

https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

Next configure your command line app using `aws configure`.  

You will need to have an aws account key and secret which can be generated in the IAM console.

A guide to generating credentials can be found here: 

https://docs.aws.amazon.com/powershell/latest/userguide/pstools-appendix-sign-up.html

Install aws-cdk command line tool: 

```
npm install -g aws-cdk
```

The `cdk.json` file tells the CDK Toolkit how to execute the app.

## How to use in your own environment

Clone this repo and edit `pio-node.ts` to use the parameters you need to start your chain. 

The following is an example used to create a `testnet` chain with the moniker `my-moniker`


```
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PioNodeStack } from '../lib/pio-node-stack';

const app = new cdk.App();

new PioNodeStack(app, 'PioNodeStack', {
  nodeMoniker: 'my-moniker',
  chainId: 'pio-testnet-1',
  instanceName: 'pio-node-testnet',
  chainVersion: 'testnet'
});
```

These are the following default properties if they are not set in the `PioNodeStack` instantiation: 

```
instnaceName: pio-node
goVersion: go1.18.linux-amd64
provenanceUrl: https://api.github.com/repos/provenance-io/provenance/releases/latest 
chainVersion: testnet
chainId: pio-testnet-1
nodeMoniker: cdk-generated-node
```
