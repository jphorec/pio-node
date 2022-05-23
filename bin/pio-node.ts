#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PioNodeStack } from '../lib/pio-node-stack';

const app = new cdk.App();

new PioNodeStack(app, 'PioNodeStack', {
  instanceName: 'pio-node-mainnet',
  nodeMoniker: 'jhorecny-validator',
  chainId: 'pio-mainnet-1',
  chainVersion: 'mainnet'
});