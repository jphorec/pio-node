#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PioNodeStack } from '../lib/pio-node-stack';

const app = new cdk.App();

new PioNodeStack(app, 'PioNodeStack', {
  instanceName: 'pio-node-testnet',
  nodeMoniker: 'aws-node-by-cdk'
});