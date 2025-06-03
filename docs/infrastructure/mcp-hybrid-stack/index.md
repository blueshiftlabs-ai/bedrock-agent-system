# Infrastructure Documentation

## Overview

The MCP Hybrid Stack infrastructure is built using AWS CDK (Cloud Development Kit) and provides a complete, production-ready deployment of the Bedrock Agent System on AWS.

## Architecture Components

### Compute Layer
- **ECS Fargate**: Serverless container orchestration
- **Application Load Balancer**: Traffic distribution and SSL termination
- **Auto Scaling**: Dynamic scaling based on metrics

### Data Layer
- **DynamoDB**: NoSQL database for workflow state and metadata
- **S3**: Object storage for files and artifacts
- **Neptune**: Graph database for knowledge management
- **OpenSearch Serverless**: Vector search capabilities

### Security Layer
- **VPC**: Network isolation with public/private subnets
- **Security Groups**: Fine-grained network access control
- **WAF**: Web Application Firewall for protection
- **Secrets Manager**: Secure credential storage

### Monitoring Layer
- **CloudWatch**: Logs, metrics, and alarms
- **X-Ray**: Distributed tracing
- **CloudWatch Insights**: Log analysis and querying

## CDK Stack Structure

```
infrastructure/mcp-hybrid-stack/
├── bin/
│   └── app.ts                 # CDK app entry point
├── lib/
│   └── mcp-hybrid-stack.ts    # Main stack definition
├── constructs/
│   ├── compute/
│   │   ├── ecs-service.ts     # ECS service construct
│   │   └── load-balancer.ts   # ALB construct
│   ├── data/
│   │   ├── dynamodb.ts        # DynamoDB tables
│   │   ├── s3.ts              # S3 buckets
│   │   └── neptune.ts         # Neptune cluster
│   ├── security/
│   │   ├── vpc.ts             # VPC configuration
│   │   └── waf.ts             # WAF rules
│   └── monitoring/
│       └── cloudwatch.ts      # Monitoring setup
└── stacks/
    ├── dev-stack.ts           # Development environment
    ├── staging-stack.ts       # Staging environment
    └── prod-stack.ts          # Production environment
```

## Key Constructs

### [ECS Service Construct](./constructs/ecs-service.md)
Manages the containerized application deployment.

### [Database Construct](./constructs/database.md)
Provisions and configures all data storage services.

### [Networking Construct](./constructs/networking.md)
Sets up VPC, subnets, and network security.

### [Monitoring Construct](./constructs/monitoring.md)
Configures logging, metrics, and alerting.

## Environment Configuration

### Development
```typescript
{
  env: {
    account: '123456789012',
    region: 'us-east-1'
  },
  instanceType: 't3.medium',
  desiredCount: 1,
  enableWaf: false,
  enableBackups: false
}
```

### Production
```typescript
{
  env: {
    account: '987654321098',
    region: 'us-east-1'
  },
  instanceType: 'c5.xlarge',
  desiredCount: 3,
  enableWaf: true,
  enableBackups: true,
  multiAz: true
}
```

## Deployment

### Prerequisites
- AWS CDK CLI installed
- AWS credentials configured
- Node.js and pnpm installed

### Deploy Infrastructure

```bash
# Install dependencies
pnpm install

# Bootstrap CDK (first time only)
pnpm infrastructure:bootstrap

# Deploy to development
pnpm infrastructure:deploy -- --context environment=dev

# Deploy to production
pnpm infrastructure:deploy -- --context environment=prod
```

### Update Infrastructure

```bash
# Preview changes
pnpm infrastructure:diff

# Apply updates
pnpm infrastructure:deploy
```

### Destroy Infrastructure

```bash
# Remove all resources
pnpm infrastructure:destroy
```

## Cost Optimization

### Development Environment
- Use smaller instance types
- Single AZ deployment
- On-demand pricing
- Minimal backup retention

### Production Environment
- Reserved instances for predictable workloads
- Auto-scaling for cost efficiency
- S3 lifecycle policies
- CloudWatch log retention policies

## Security Best Practices

1. **Least Privilege**: IAM roles with minimal required permissions
2. **Encryption**: All data encrypted at rest and in transit
3. **Network Isolation**: Private subnets for compute resources
4. **Secrets Management**: No hardcoded credentials
5. **Audit Logging**: CloudTrail enabled for all API calls

## Monitoring and Alerts

### Key Metrics
- ECS service health
- Response time and latency
- Error rates
- Resource utilization

### Alerts
- Service unavailable
- High error rate (>5%)
- Database connection failures
- Disk space warnings

## Backup and Recovery

### Automated Backups
- DynamoDB: Point-in-time recovery enabled
- S3: Versioning and cross-region replication
- Neptune: Automated snapshots daily

### Disaster Recovery
- RTO: 4 hours
- RPO: 1 hour
- Multi-region failover capability
- Automated backup testing

## Troubleshooting

### Common Issues

1. **Stack Creation Fails**
   - Check AWS service limits
   - Verify IAM permissions
   - Review CloudFormation events

2. **Application Not Accessible**
   - Check security group rules
   - Verify ALB target health
   - Review ECS task logs

3. **Performance Issues**
   - Check CloudWatch metrics
   - Review X-Ray traces
   - Analyze database query performance