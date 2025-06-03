# Parameter Store and Secrets Manager Guide

This guide explains how the MCP Hybrid Server infrastructure uses AWS Parameter Store and Secrets Manager to manage configuration and secrets.

## Overview

The infrastructure automatically stores all resource endpoints and configurations in AWS Parameter Store and sensitive values in AWS Secrets Manager. This provides:

- **Centralized Configuration**: All AWS resource endpoints are automatically stored
- **Secure Secret Management**: Sensitive values like API keys and passwords are encrypted
- **Environment Isolation**: Parameters are organized hierarchically by stage (dev/staging/prod)
- **Easy Access**: Applications can retrieve configuration at runtime
- **Audit Trail**: AWS tracks all parameter access and modifications

## Parameter Hierarchy

Parameters follow this naming convention:
```
/mcp-hybrid/{stage}/{service}/{parameter}
```

Example parameters:
```
/mcp-hybrid/dev/vpc/id
/mcp-hybrid/dev/s3/data-bucket/name
/mcp-hybrid/dev/dynamodb/metadata-table/arn
/mcp-hybrid/dev/neptune/cluster/endpoint
/mcp-hybrid/dev/opensearch/collection/endpoint
```

## Stored Parameters

### VPC Configuration
- `/vpc/id` - VPC ID
- `/vpc/cidr` - VPC CIDR block

### S3 Buckets
- `/s3/data-bucket/name` - Data bucket name
- `/s3/data-bucket/arn` - Data bucket ARN
- `/s3/logs-bucket/name` - Logs bucket name
- `/s3/logs-bucket/arn` - Logs bucket ARN

### DynamoDB Tables
- `/dynamodb/metadata-table/name` - Metadata table name
- `/dynamodb/metadata-table/arn` - Metadata table ARN
- `/dynamodb/workflow-state-table/name` - Workflow state table name
- `/dynamodb/workflow-state-table/arn` - Workflow state table ARN
- `/dynamodb/workflow-state-table/status-index` - GSI name for status queries

### OpenSearch
- `/opensearch/collection/name` - Collection name
- `/opensearch/collection/endpoint` - Collection endpoint URL
- `/opensearch/collection/arn` - Collection ARN

### Neptune
- `/neptune/cluster/endpoint` - Cluster endpoint
- `/neptune/cluster/port` - Cluster port
- `/neptune/cluster/resource-id` - Cluster resource identifier

### ECS
- `/ecs/cluster/name` - ECS cluster name
- `/ecs/cluster/arn` - ECS cluster ARN
- `/ecs/service/name` - ECS service name
- `/ecs/service/arn` - ECS service ARN

### Load Balancer
- `/alb/dns-name` - ALB DNS name
- `/alb/arn` - ALB ARN
- `/alb/url` - Full application URL

### Auto Scaling
- `/autoscaling/min-capacity` - Minimum task count
- `/autoscaling/max-capacity` - Maximum task count
- `/autoscaling/cpu-target` - Target CPU utilization
- `/autoscaling/memory-target` - Target memory utilization

### IAM Roles
- `/iam/task-role/arn` - ECS task role ARN
- `/iam/task-role/name` - ECS task role name
- `/iam/execution-role/arn` - ECS execution role ARN

## Secrets in Secrets Manager

Secrets follow this naming convention:
```
/mcp-hybrid/{stage}/{secret-name}
```

### Stored Secrets
- `/database/credentials` - Database username and password
- `/api/keys` - External API keys (OpenAI, Anthropic, etc.)

## Using the Parameter Store

### 1. During Deployment

The deployment script automatically generates environment files:
```bash
./deployment/deploy.sh dev
```

This creates:
- `.env` - Environment variables file
- `export-env.sh` - Shell script to export variables
- `docker.env` - Docker-compatible env file

### 2. Manual Retrieval

Use the build-env script:
```bash
cd infrastructure/mcp-hybrid-stack
pnpm build-env generate \
  --manifest parameter-manifest-dev.json \
  --region us-east-1 \
  --output ./output
```

### 3. AWS CLI

Get a single parameter:
```bash
aws ssm get-parameter \
  --name "/mcp-hybrid/dev/neptune/cluster/endpoint" \
  --region us-east-1
```

Get all parameters by path:
```bash
aws ssm get-parameters-by-path \
  --path "/mcp-hybrid/dev" \
  --recursive \
  --region us-east-1
```

Get a secret:
```bash
aws secretsmanager get-secret-value \
  --secret-id "/mcp-hybrid/dev/api/keys" \
  --region us-east-1
```

### 4. In Application Code

The application automatically loads parameters at startup:

```typescript
// Parameters are loaded from Parameter Store if PARAMETER_STORE_PREFIX is set
const config = await configuration();

// Access configuration
console.log(config.aws.neptune.endpoint);
console.log(config.aws.s3.bucketName);
```

## IAM Permissions

The ECS task role is automatically granted permissions to:
- Read all parameters under `/mcp-hybrid/{stage}/*`
- Read all secrets under `/mcp-hybrid/{stage}/*`

## Parameter Manifest

After deployment, a manifest file is created:
```
parameter-manifest-{stage}.json
```

This file contains:
- All parameter paths
- All secret names
- Deployment metadata

## Best Practices

1. **Never hardcode endpoints** - Always use Parameter Store
2. **Use appropriate parameter types** - SecureString for sensitive data
3. **Follow naming conventions** - Maintain the hierarchical structure
4. **Version sensitive changes** - Use AWS Secrets Manager rotation for passwords
5. **Monitor access** - Enable CloudTrail for audit logging
6. **Cache parameters** - The application caches parameters for 5 minutes by default

## Troubleshooting

### Missing Parameters
If parameters are missing:
1. Check the parameter manifest file
2. Verify the CDK stack deployed successfully
3. Check IAM permissions

### Access Denied
If you get access denied errors:
1. Verify the task role has proper permissions
2. Check the parameter path is correct
3. Ensure the AWS region is correct

### Stale Values
If values seem outdated:
1. Clear the application cache
2. Restart the ECS service
3. Check Parameter Store directly

## Adding New Parameters

To add new parameters:

1. Update the CDK stack:
```typescript
this.parameterStore.addParameter({
  path: 'my-service/endpoint',
  value: myService.endpoint,
  description: 'My service endpoint',
});
```

2. Redeploy the stack:
```bash
cdk deploy McpHybridStack-dev
```

3. The parameter will be automatically available to the application