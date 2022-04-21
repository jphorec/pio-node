#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PioNodeStack } from '../lib/pio-node-stack';

const app = new cdk.App();

new PioNodeStack(app, 'PioNodeStack', {
  nodeMoniker: "pizza-time",
  chainId: 'pio-testnet-1',
  instanceName: 'pio-node-testnet',
  goVersion: 'go1.18.linux-amd64',
  chainVersion: 'testnet'
});