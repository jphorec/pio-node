#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PioNodeStack } from '../lib/pio-node-stack';

const app = new cdk.App();

new PioNodeStack(app, 'PioMainnetStack', {
  instanceName: 'pio-node-mainnet-test',
  nodeMoniker: 'josh-test-validator',
  chainId: 'pio-mainnet-1',
  chainVersion: 'mainnet',
  provenanceUrl: 'https://github.com/provenance-io/provenance/archive/refs/tags/v1.10.0.zip'
});