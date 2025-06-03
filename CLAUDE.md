# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a monorepo containing the Bedrock Agent System, which includes an MCP (Model Context Protocol) Hybrid Server built with NestJS and LangGraph, designed for production-scale microservice transformation and analysis. The project uses pnpm workspaces and Turbo for efficient builds.

## Repository Structure

```
bedrock-agent-system/
├── apps/                     # Application packages
│   └── mcp-hybrid-server/   # Main NestJS + LangGraph server
├── packages/                 # Shared packages
│   ├── eslint-config/       # Shared ESLint configurations
│   ├── typescript-config/   # Shared TypeScript configurations
│   └── prettier-config/     # Shared Prettier configurations
├── infrastructure/          # Infrastructure packages
│   └── mcp-hybrid-stack/    # AWS CDK infrastructure
└── deployment/              # Deployment scripts
```

## Key Commands

### Monorepo Commands
```bash
pnpm install              # Install all dependencies
turbo build               # Build all packages
turbo dev                 # Run all in development mode
turbo test                # Run all tests
turbo lint                # Lint all packages
```

### Application-Specific Commands
```bash
pnpm app:dev              # Run MCP server in dev mode
pnpm app:build            # Build MCP server
pnpm app:test             # Test MCP server
pnpm --filter @apps/mcp-hybrid-server docker:build  # Build Docker image
```

### Infrastructure Commands
```bash
pnpm infrastructure:synth    # Synthesize CloudFormation
pnpm infrastructure:deploy   # Deploy infrastructure
pnpm infrastructure:destroy  # Destroy infrastructure
```

### Deployment
```bash
./deployment/deploy.sh dev   # Deploy to development
./deployment/deploy.sh prod  # Deploy to production
```

### Setup
```bash
pnpm install
pnpm --filter @apps/mcp-hybrid-server run setup-local-dev  # Setup local development
```

## Architecture Overview

### Module Structure
The application uses NestJS's modular architecture with these core modules:

- **WorkflowModule**: Orchestrates LangGraph workflows for complex multi-step analysis
- **AgentModule**: Houses specialized AI agents (CodeAnalyzer, DatabaseAnalyzer, KnowledgeBuilder, DocumentationGenerator)
- **ToolModule**: Implements MCP tools with a dynamic registry pattern
- **AwsModule**: Manages AWS service integrations (Bedrock, DynamoDB, S3, OpenSearch, Neptune)
- **MemoryModule**: Handles persistent memory and context management
- **IndexingModule**: Provides code indexing and search capabilities

### Key Patterns

1. **Agent System**: All agents extend `BaseAgent` and implement specialized analysis tasks
2. **Tool Registry**: Tools self-register with `MCPToolRegistry` on initialization
3. **Workflow State**: LangGraph manages stateful workflows with persistence to DynamoDB
4. **Event-Driven**: Uses EventEmitter for decoupled module communication
5. **MCP Protocol**: Exposed at `/mcp` endpoint for tool interactions

### AWS Integration
- **Bedrock**: AI model invocation for agents
- **DynamoDB**: Workflow state and metadata persistence
- **S3**: File storage for analysis artifacts
- **OpenSearch Serverless**: Vector search capabilities
- **Neptune**: Knowledge graph storage

### Testing Approach
- Unit tests are located alongside source files
- Integration tests in `test/integration/`
- E2E tests in `test/e2e/`
- Use Jest with TypeScript support
- Mock AWS services using LocalStack in development

### Important Files
- `apps/mcp-hybrid-server/src/main.ts`: Application entry point
- `apps/mcp-hybrid-server/src/workflows/graphs/`: Workflow definitions
- `apps/mcp-hybrid-server/src/agents/base/base.agent.ts`: Base agent implementation
- `apps/mcp-hybrid-server/src/tools/registry/tool.registry.ts`: Tool registration system
- `infrastructure/mcp-hybrid-stack/lib/mcp-hybrid-stack.ts`: AWS CDK infrastructure definition