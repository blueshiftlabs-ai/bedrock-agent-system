# MCP Hybrid Stack Infrastructure

AWS CDK infrastructure for the MCP Hybrid Server, providing production-ready deployment with auto-scaling, monitoring, and security best practices.

## Overview

This package contains the AWS CDK infrastructure code for deploying the MCP Hybrid Server to AWS. It includes all necessary AWS resources including ECS Fargate, Application Load Balancer, DynamoDB, S3, and networking components.

## Architecture

The infrastructure includes:

- **ECS Fargate**: Containerized application deployment
- **Application Load Balancer**: Traffic distribution with health checks
- **Auto Scaling**: CPU, memory, and request-based scaling
- **DynamoDB**: Workflow state and metadata persistence
- **S3**: File storage for analysis artifacts
- **OpenSearch Serverless**: Vector search capabilities
- **Neptune**: Knowledge graph storage
- **VPC**: Network isolation with public/private subnets
- **CloudWatch**: Logging, metrics, and alarms

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Node.js 20+
- pnpm 10+

## Deployment

### Bootstrap CDK (First Time Only)

```bash
pnpm bootstrap
```

### Deploy Infrastructure

```bash
# Synthesize CloudFormation template
pnpm synth

# Deploy to AWS
pnpm deploy

# Deploy with specific stage
cdk deploy McpHybridStack-dev
cdk deploy McpHybridStack-prod
```

### Destroy Infrastructure

```bash
pnpm destroy
```

## Configuration

### Environment Variables

Set these environment variables for production deployments:

```bash
export DOMAIN_NAME=mcp.yourdomain.com
export CERTIFICATE_ARN=arn:aws:acm:region:account:certificate/cert-id
export STAGE=prod
```

### Stack Parameters

The CDK stack accepts the following parameters:

- `stage`: Deployment stage (dev, staging, prod)
- `vpcCidr`: VPC CIDR block (default: 10.0.0.0/16)
- `minCapacity`: Minimum ECS tasks (default: 1)
- `maxCapacity`: Maximum ECS tasks (default: 10)
- `cpu`: Task CPU units (default: 1024)
- `memory`: Task memory in MiB (default: 2048)

## Stack Outputs

After deployment, the stack provides these outputs:

- `ServiceUrl`: Application load balancer URL
- `DataBucketName`: S3 bucket for data storage
- `VpcId`: VPC identifier
- `ClusterArn`: ECS cluster ARN
- `ServiceArn`: ECS service ARN

## Cost Optimization

The infrastructure includes several cost optimization features:

- **Fargate Spot**: Uses spot instances for non-critical workloads
- **Auto Scaling**: Scales down during low usage periods
- **S3 Lifecycle Policies**: Automatic archival of old data
- **On-Demand Resources**: Serverless components where appropriate

## Security

Security features include:

- **IAM Roles**: Least privilege access for all services
- **VPC**: Network isolation with security groups
- **Encryption**: All data encrypted at rest and in transit
- **Secrets Manager**: Secure storage of sensitive configuration
- **WAF**: Optional Web Application Firewall integration

## Monitoring

Built-in monitoring includes:

- **CloudWatch Dashboards**: Service metrics visualization
- **Alarms**: Automated alerts for critical metrics
- **X-Ray**: Distributed tracing (optional)
- **Log Groups**: Centralized logging with retention policies

## Development

### Local Testing

```bash
# Run CDK tests
pnpm test

# Lint CDK code
pnpm lint

# Check for CDK issues
cdk doctor
```

### CDK Commands

```bash
# List all stacks
cdk list

# Show stack differences
pnpm diff

# Generate CloudFormation template
cdk synth > template.yaml
```

## Troubleshooting

### Common Issues

1. **Deployment Failures**
   - Check AWS service limits
   - Verify IAM permissions
   - Review CloudFormation events

2. **Access Denied Errors**
   - Ensure CDK is bootstrapped
   - Check AWS credentials
   - Verify account/region settings

3. **Resource Conflicts**
   - Check for existing resources with same names
   - Use unique stack names for multiple deployments

## Contributing

1. Make infrastructure changes
2. Test with `cdk synth` and `cdk diff`
3. Deploy to development environment
4. Submit pull request with changes

## Related Documentation

- [Monorepo README](../../README.md)
- [Application README](../../apps/mcp-hybrid-server/README.md)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)