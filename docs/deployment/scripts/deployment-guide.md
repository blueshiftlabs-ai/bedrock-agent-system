# Deployment Guide

## Overview

This guide covers the deployment process for the Bedrock Agent System across different environments. We use automated deployment scripts with AWS CDK and GitHub Actions for CI/CD.

## Deployment Architecture

```
┌───────────────────────────┐
│   GitHub Repository       │
│   (Source Control)        │
└───────────┬───────────────┘
              │
              ▼
┌───────────────────────────┐
│   GitHub Actions          │
│   (CI/CD Pipeline)        │
└───────────┬───────────────┘
              │
    ┌─────────´─────────┐
    ▼                     ▼
┌───────────────┐  ┌───────────────┐
│ ECR Registry  │  │ S3 Artifacts  │
│ (Images)      │  │ (Assets)      │
└───────┬───────┘  └───────┬───────┘
         │                     │
         └───────┬───────────┘
                 ▼
     ┌─────────────────────┐
     │   AWS Environment      │
     │   (Dev/Staging/Prod)   │
     └─────────────────────┘
```

## Prerequisites

### Local Machine
- AWS CLI configured with appropriate credentials
- Docker installed and running
- Node.js 18+ and pnpm
- Access to AWS accounts (dev/staging/prod)

### AWS Setup
- ECR repositories created
- S3 deployment bucket
- Route53 hosted zones (for custom domains)
- ACM certificates (for HTTPS)

## Deployment Scripts

### Main Deployment Script

Location: `deployment/deploy.sh`

```bash
#!/bin/bash
# Usage: ./deploy.sh <environment> [options]
# Example: ./deploy.sh prod --skip-tests

ENVIRONMENT=$1
SKIP_TESTS=${2:-false}

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "Invalid environment. Use: dev, staging, or prod"
  exit 1
fi

# Build and test
if [[ "$SKIP_TESTS" != "--skip-tests" ]]; then
  pnpm test
fi

# Build Docker image
pnpm --filter @apps/mcp-hybrid-server docker:build

# Deploy infrastructure
pnpm infrastructure:deploy -- --context environment=$ENVIRONMENT

# Deploy application
./deployment/deploy-app.sh $ENVIRONMENT
```

### Destroy Script

Location: `deployment/destroy.sh`

```bash
#!/bin/bash
# Usage: ./destroy.sh <environment>
# Example: ./destroy.sh dev

ENVIRONMENT=$1

# Confirm destruction
read -p "Are you sure you want to destroy $ENVIRONMENT? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Destruction cancelled"
  exit 0
fi

# Destroy infrastructure
pnpm infrastructure:destroy -- --context environment=$ENVIRONMENT
```

## Environment-Specific Configuration

### Development Environment

```yaml
# deployment/environments/dev.yaml
name: development
region: us-east-1
account: "123456789012"
instances:
  type: t3.medium
  count: 1
  spot: true
features:
  waf: false
  backups: false
  monitoring: basic
domain: dev.bedrock-agent.example.com
```

### Staging Environment

```yaml
# deployment/environments/staging.yaml
name: staging
region: us-east-1
account: "234567890123"
instances:
  type: t3.large
  count: 2
  spot: false
features:
  waf: true
  backups: true
  monitoring: enhanced
domain: staging.bedrock-agent.example.com
```

### Production Environment

```yaml
# deployment/environments/prod.yaml
name: production
region: us-east-1
account: "345678901234"
instances:
  type: c5.xlarge
  count: 3
  spot: false
  multiAz: true
features:
  waf: true
  backups: true
  monitoring: full
  alerting: pagerduty
domain: api.bedrock-agent.example.com
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, staging, develop]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        type: choice
        options:
          - dev
          - staging
          - prod

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Run tests
        run: pnpm test
        
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE }}
          aws-region: us-east-1
          
      - name: Deploy
        run: ./deployment/deploy.sh ${{ inputs.environment || 'dev' }}
```

## Step-by-Step Deployment Process

### 1. Pre-deployment Checks

```bash
# Check current deployed version
aws ecs describe-services \
  --cluster mcp-hybrid-cluster \
  --services mcp-hybrid-service \
  --query 'services[0].taskDefinition'

# Check infrastructure status
pnpm infrastructure:diff -- --context environment=prod

# Verify secrets are set
aws secretsmanager get-secret-value \
  --secret-id mcp-hybrid/prod/config
```

### 2. Build and Test

```bash
# Run full test suite
pnpm test

# Build application
pnpm build

# Build Docker image
pnpm --filter @apps/mcp-hybrid-server docker:build

# Test Docker image locally
docker run -p 3000:3000 mcp-hybrid-server:latest
```

### 3. Deploy Infrastructure

```bash
# Deploy infrastructure changes
pnpm infrastructure:deploy -- --context environment=prod

# Wait for infrastructure to stabilize
aws cloudformation wait stack-update-complete \
  --stack-name MCPHybridStack-Prod
```

### 4. Deploy Application

```bash
# Push Docker image to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

docker tag mcp-hybrid-server:latest \
  $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mcp-hybrid-server:latest

docker push \
  $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mcp-hybrid-server:latest

# Update ECS service
aws ecs update-service \
  --cluster mcp-hybrid-cluster \
  --service mcp-hybrid-service \
  --force-new-deployment
```

### 5. Post-deployment Verification

```bash
# Check deployment status
aws ecs wait services-stable \
  --cluster mcp-hybrid-cluster \
  --services mcp-hybrid-service

# Verify health endpoint
curl https://api.bedrock-agent.example.com/health

# Run smoke tests
pnpm test:smoke -- --env=prod

# Check CloudWatch logs
aws logs tail /ecs/mcp-hybrid-server --follow
```

## Rollback Procedures

### Automatic Rollback

ECS automatically rolls back failed deployments based on:
- Health check failures
- Task startup failures
- CloudWatch alarms

### Manual Rollback

```bash
# List previous task definitions
aws ecs list-task-definitions \
  --family-prefix mcp-hybrid-server \
  --sort DESC

# Update service to previous version
aws ecs update-service \
  --cluster mcp-hybrid-cluster \
  --service mcp-hybrid-service \
  --task-definition mcp-hybrid-server:123

# For infrastructure rollback
git checkout <previous-commit>
pnpm infrastructure:deploy -- --context environment=prod
```

## Blue-Green Deployment

### Setup

1. Create two target groups in ALB
2. Configure weighted routing
3. Deploy to green environment
4. Gradually shift traffic
5. Complete cutover

### Traffic Shifting

```bash
# Start with 10% traffic to new version
aws elbv2 modify-rule \
  --rule-arn $RULE_ARN \
  --actions Type=forward,ForwardConfig='{"TargetGroups":[{"TargetGroupArn":"$GREEN_TG","Weight":10},{"TargetGroupArn":"$BLUE_TG","Weight":90}]}'

# Monitor metrics
# Gradually increase traffic: 25%, 50%, 100%
```

## Monitoring Deployment

### Key Metrics
- Deployment duration
- Task startup time
- Health check status
- Error rates
- Response times

### CloudWatch Dashboard

Access deployment dashboard:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=MCP-Hybrid-Deployment
```

### Alerts

- Deployment failure
- High error rate post-deployment
- Service unavailable
- Memory/CPU spikes

## Troubleshooting

### Common Issues

1. **ECS Task Fails to Start**
   ```bash
   # Check task logs
   aws ecs describe-tasks \
     --cluster mcp-hybrid-cluster \
     --tasks <task-arn>
   
   # View stopped task reason
   aws ecs describe-tasks \
     --cluster mcp-hybrid-cluster \
     --tasks <task-arn> \
     --query 'tasks[0].stoppedReason'
   ```

2. **Health Check Failures**
   ```bash
   # Test health endpoint directly
   curl -v http://<task-ip>:3000/health
   
   # Check security groups
   aws ec2 describe-security-groups \
     --group-ids <sg-id>
   ```

3. **Image Pull Errors**
   ```bash
   # Verify ECR permissions
   aws ecr get-repository-policy \
     --repository-name mcp-hybrid-server
   
   # Check image exists
   aws ecr describe-images \
     --repository-name mcp-hybrid-server
   ```

## Security Considerations

### Deployment Security

1. **Least Privilege**: Deploy roles have minimal permissions
2. **Audit Trail**: All deployments logged in CloudTrail
3. **Approval Process**: Production requires manual approval
4. **Secret Rotation**: Automated secret rotation before deployment

### Post-Deployment Security

```bash
# Run security scan
pnpm audit

# Scan Docker image
trivy image $IMAGE_URI

# Verify WAF rules
aws wafv2 get-web-acl \
  --name mcp-hybrid-waf \
  --scope REGIONAL
```

## Best Practices

1. **Always deploy to staging first**
2. **Run full test suite before production**
3. **Monitor metrics during deployment**
4. **Keep deployment windows small**
5. **Document all manual interventions**
6. **Maintain rollback procedures**
7. **Communicate deployment status**