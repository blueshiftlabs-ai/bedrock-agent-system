# Frequently Asked Questions

## General Questions

### What is the Bedrock Agent System?

The Bedrock Agent System is an enterprise-grade platform for AI-powered code analysis, transformation, and documentation generation. It combines AWS Bedrock's AI capabilities with a robust microservices architecture.

### What are the main use cases?

1. **Code Modernization**: Analyze legacy codebases and suggest modernization strategies
2. **Documentation Generation**: Automatically create comprehensive documentation
3. **Code Quality Analysis**: Identify patterns, anti-patterns, and improvement opportunities
4. **Knowledge Management**: Build and maintain organizational knowledge graphs

### What technologies does it use?

- **Backend**: NestJS, TypeScript, LangGraph
- **AI/ML**: AWS Bedrock, Claude 3
- **Infrastructure**: AWS CDK, ECS Fargate, DynamoDB, S3
- **Protocols**: MCP (Model Context Protocol), REST API

## Installation & Setup

### What are the system requirements?

- Node.js 18 or higher
- pnpm 8 or higher
- Docker and Docker Compose
- AWS account with appropriate permissions
- 8GB RAM minimum (16GB recommended)

### How do I install dependencies?

```bash
pnpm install
```

### Why use pnpm instead of npm?

pnpm provides:
- Faster installation times
- Efficient disk space usage
- Better monorepo support
- Strict dependency resolution

## Development

### How do I run the application locally?

```bash
pnpm app:dev
```

### How do I run tests?

```bash
# All tests
pnpm test

# Specific test types
pnpm app:test        # Unit tests
pnpm app:test:e2e    # E2E tests
pnpm app:test:integration  # Integration tests
```

### How do I debug the application?

The application supports VSCode debugging. Use the provided launch configurations or attach to the running process on port 9229.

## Architecture

### What is an Agent?

Agents are specialized AI components that handle specific analysis tasks. Each agent extends BaseAgent and implements domain-specific logic.

### What is a Tool?

Tools are MCP-compliant functions that AI models can invoke. They provide standardized interfaces for various operations.

### What is a Workflow?

Workflows are LangGraph-based orchestrations that coordinate multiple steps, agents, and tools to accomplish complex tasks.

### How does state persistence work?

Workflow state is persisted to DynamoDB with checkpointing support, allowing workflows to resume after failures.

## Deployment

### How do I deploy to AWS?

```bash
./deployment/deploy.sh <environment>
```

Where environment is: dev, staging, or prod

### What AWS services are required?

- ECS Fargate for compute
- DynamoDB for state storage
- S3 for file storage
- Bedrock for AI models
- CloudWatch for monitoring

### How much does it cost to run?

Costs vary by usage but typical monthly costs:
- Development: $50-100
- Staging: $200-300
- Production: $500-2000+

## Troubleshooting

### The application won't start

1. Check Node.js version: `node --version`
2. Verify dependencies: `pnpm install`
3. Check environment variables: `.env` file
4. Review logs: `pnpm app:dev`

### AWS credentials not working

```bash
# Verify credentials
aws sts get-caller-identity

# For local development with LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
```

### Docker build fails

1. Ensure Docker is running
2. Check available disk space
3. Clear Docker cache: `docker system prune`
4. Rebuild: `pnpm --filter @apps/mcp-hybrid-server docker:build`

## Security

### How is authentication handled?

The system uses JWT tokens for authentication. Tokens must be included in the Authorization header.

### Are API calls encrypted?

Yes, all API calls use HTTPS/TLS encryption in transit. Data is also encrypted at rest using AWS KMS.

### How are secrets managed?

Secrets are stored in AWS Secrets Manager and injected at runtime. Never commit secrets to code.

## Performance

### How many concurrent workflows can run?

The system auto-scales based on load. Default limits:
- Development: 10 concurrent
- Production: 100+ concurrent

### What's the typical response time?

- Tool execution: 100ms - 5s
- Simple workflows: 5-30s
- Complex analysis: 1-10 minutes

### How can I improve performance?

1. Enable caching where appropriate
2. Use appropriate instance types
3. Optimize workflow designs
4. Monitor and adjust auto-scaling

## Contributing

### How can I contribute?

See our [Contributing Guidelines](../../contributing/guidelines.md) for detailed information.

### Where do I report bugs?

Create an issue on GitHub with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details

### How do I suggest features?

Open a GitHub discussion or issue with:
- Use case description
- Proposed solution
- Alternative considerations

## Support

### Where can I get help?

1. Check this FAQ
2. Review documentation
3. Search GitHub issues
4. Join our Discord community
5. Contact support team

### Is there commercial support?

Yes, enterprise support plans are available. Contact sales@example.com for details.

### How often are updates released?

- Security patches: As needed
- Bug fixes: Weekly
- Minor features: Monthly
- Major releases: Quarterly