# Quick Start Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 18+ and pnpm 8+
- Docker and Docker Compose
- AWS CLI configured with appropriate credentials
- Git

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/bedrock-agent-system.git
cd bedrock-agent-system
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

Copy the example environment file and update with your values:

```bash
cp apps/mcp-hybrid-server/.env.example apps/mcp-hybrid-server/.env
```

Required environment variables:
```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# Bedrock Configuration
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet
BEDROCK_REGION=us-east-1

# Database Configuration
DYNAMODB_TABLE_PREFIX=mcp-hybrid
S3_BUCKET_NAME=mcp-hybrid-storage

# Application Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
```

### 4. Setup Local Development

```bash
pnpm --filter @apps/mcp-hybrid-server run setup-local-dev
```

This script will:
- Create necessary Docker networks
- Start LocalStack for AWS services
- Initialize local databases
- Seed sample data

## Running the Application

### Development Mode

```bash
pnpm app:dev
```

The server will start on `http://localhost:3000` with hot-reload enabled.

### Docker Mode

```bash
# Build the Docker image
pnpm --filter @apps/mcp-hybrid-server docker:build

# Run with Docker Compose
cd apps/mcp-hybrid-server
docker-compose -f docker/docker-compose.dev.yml up
```

## Your First Workflow

### 1. Check Server Health

```bash
curl http://localhost:3000/health
```

### 2. List Available Tools

```bash
curl http://localhost:3000/mcp/tools \
  -H "Authorization: Bearer your-token"
```

### 3. Execute a Simple Analysis

```bash
curl -X POST http://localhost:3000/workflows/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "workflowType": "code-analysis",
    "input": {
      "repository": "https://github.com/example/sample-repo",
      "branch": "main"
    }
  }'
```

### 4. Check Workflow Status

```bash
curl http://localhost:3000/workflows/{workflow-id} \
  -H "Authorization: Bearer your-token"
```

## Testing

### Run All Tests

```bash
pnpm test
```

### Run Specific Test Suites

```bash
# Unit tests
pnpm app:test

# E2E tests
pnpm app:test:e2e

# Integration tests
pnpm app:test:integration
```

## Common Issues

### Port Already in Use

```bash
# Find and kill the process using port 3000
lsof -ti:3000 | xargs kill -9
```

### LocalStack Not Starting

```bash
# Reset LocalStack
docker-compose -f docker/docker-compose.dev.yml down -v
docker-compose -f docker/docker-compose.dev.yml up -d localstack
```

### AWS Credentials Issues

```bash
# Verify AWS credentials
aws sts get-caller-identity

# For LocalStack, use dummy credentials
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
```

## Next Steps

- [Understanding the Architecture](../../architecture/system-overview/overview.md)
- [Creating Custom Agents](../advanced/creating-custom-agents.md)
- [Deploying to Production](../../deployment/scripts/deployment-guide.md)
- [API Documentation](../../api-reference/rest/endpoints.md)

## Getting Help

- Check the [FAQ](./faq.md)
- Review [Troubleshooting Guide](./troubleshooting.md)
- Join our [Discord Community](https://discord.gg/example)
- Open an [Issue on GitHub](https://github.com/your-org/bedrock-agent-system/issues)