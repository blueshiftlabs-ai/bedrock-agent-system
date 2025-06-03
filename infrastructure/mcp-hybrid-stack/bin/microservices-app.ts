#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MicroservicesStack } from '../lib/microservices-stack';

const app = new cdk.App();

// Get environment configuration
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Environment-specific configuration
const envConfig = {
  dev: {
    domainName: undefined,
    certificateArn: undefined,
    vpcId: undefined,
  },
  staging: {
    domainName: process.env.STAGING_DOMAIN_NAME,
    certificateArn: process.env.STAGING_CERTIFICATE_ARN,
    vpcId: process.env.STAGING_VPC_ID,
  },
  prod: {
    domainName: process.env.PROD_DOMAIN_NAME,
    certificateArn: process.env.PROD_CERTIFICATE_ARN,
    vpcId: process.env.PROD_VPC_ID,
  },
};

// Validate stage
if (!['dev', 'staging', 'prod'].includes(stage)) {
  throw new Error(`Invalid stage: ${stage}. Must be dev, staging, or prod`);
}

const config = envConfig[stage as keyof typeof envConfig];

// Create the microservices stack
new MicroservicesStack(app, `McpMicroservicesStack-${stage}`, {
  ...config,
  stage: stage as 'dev' | 'staging' | 'prod',
  env: {
    account,
    region,
  },
  description: `MCP Hybrid Server Microservices Stack for ${stage}`,
  tags: {
    Project: 'MCP-Hybrid-Microservices',
    Stage: stage,
    Environment: stage,
    ManagedBy: 'CDK',
  },
});

// Add global tags
cdk.Tags.of(app).add('Project', 'MCP-Hybrid-Microservices');
cdk.Tags.of(app).add('Repository', 'bedrock-agent-system');
cdk.Tags.of(app).add('Team', 'Platform');