#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { McpHybridStack } from '../lib/mcp-hybrid-stack';

const app = new cdk.App();

const stages = ['dev', 'staging', 'prod'] as const;

for (const stage of stages) {
  new McpHybridStack(app, `McpHybridStack-${stage}`, {
    stage,
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
    // Add domain configuration for production
    ...(stage === 'prod' && {
      domainName: process.env.DOMAIN_NAME,
      certificateArn: process.env.CERTIFICATE_ARN,
    }),
  });
}
