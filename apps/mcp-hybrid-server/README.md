# MCP Hybrid Server

A Model Context Protocol (MCP) server built with NestJS and LangGraph for AI-driven microservice transformation and analysis.

## Overview

This application is part of the Bedrock Agent System monorepo. It provides sophisticated code analysis, workflow orchestration, and AI-powered insights for transforming monolithic applications into microservices.

## Key Features

- 🧠 **Multi-Agent System**: Specialized AI agents for code, database, and architecture analysis
- 🔄 **LangGraph Workflows**: State-managed workflow orchestration with checkpointing
- 🔍 **Comprehensive Analysis**: Repository indexing, dependency tracking, and pattern recognition
- 📚 **AI Documentation**: Automated documentation generation with microservice recommendations
- ☁️ **AWS Integration**: Bedrock, OpenSearch, Neptune, DynamoDB, and S3

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 10+
- AWS CLI configured
- Docker (optional)

### Quick Start

```bash
# From the monorepo root
pnpm install
pnpm app:dev

# Or directly in this directory
pnpm dev
```

### Available Scripts

```bash
pnpm dev          # Start in development mode
pnpm build        # Build for production
pnpm test         # Run unit tests
pnpm test:e2e     # Run end-to-end tests
pnpm lint         # Run ESLint
pnpm format       # Format with Prettier
```

### Docker Development

```bash
# Build Docker image
pnpm docker:build

# Run with Docker Compose
docker-compose -f docker/docker-compose.dev.yml up
```

## API Endpoints

- **API Documentation**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health
- **MCP Endpoint**: http://localhost:3000/mcp

## Project Structure

```
src/
├── agents/          # AI agent implementations
├── aws/             # AWS service integrations
├── config/          # Application configuration
├── integrations/    # External integrations (Bedrock, LangGraph)
├── memory/          # Memory management system
├── tools/           # MCP tool implementations
├── workflows/       # LangGraph workflow definitions
└── types/           # TypeScript type definitions
```

## Configuration

Create a `.env` file in this directory:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=anthropic.claude-3-sonnet

# Application Settings
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Feature Flags
ENABLE_MEMORY_SYSTEM=true
ENABLE_KNOWLEDGE_GRAPH=true
```

## Testing

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:e2e

# Test coverage
pnpm test:cov

# Test MCP tools
./scripts/test-tools.sh
```

## Deployment

This application is deployed as part of the monorepo. See the root deployment scripts:

```bash
# From monorepo root
./deployment/deploy.sh dev
./deployment/deploy.sh prod
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests for new functionality
4. Run `pnpm test` and `pnpm lint`
5. Submit a pull request

## Related Documentation

- [Monorepo README](../README.md)
- [Infrastructure Documentation](../infrastructure/mcp-hybrid-stack/README.md)
- [API Documentation](./docs/api/README.md)

## License

MIT