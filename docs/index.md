# Bedrock Agent System Documentation

Welcome to the comprehensive documentation for the Bedrock Agent System - a production-scale MCP (Model Context Protocol) Hybrid Server built with NestJS and LangGraph.

## Documentation Structure

### 📁 [Apps](./apps/)
- **[MCP Hybrid Server](./apps/mcp-hybrid-server/)** - Main application documentation
  - [Agents](./apps/mcp-hybrid-server/agents/) - AI agent implementations
  - [Tools](./apps/mcp-hybrid-server/tools/) - MCP tool implementations
  - [Workflows](./apps/mcp-hybrid-server/workflows/) - LangGraph workflow definitions
  - [Integrations](./apps/mcp-hybrid-server/integrations/) - External service integrations
  - [AWS Services](./apps/mcp-hybrid-server/aws/) - AWS service configurations
  - [Common Utilities](./apps/mcp-hybrid-server/common/) - Shared utilities and middleware
  - [Configuration](./apps/mcp-hybrid-server/config/) - Application configuration
  - [Health Checks](./apps/mcp-hybrid-server/health/) - Health monitoring
  - [Indexing](./apps/mcp-hybrid-server/indexing/) - Code indexing capabilities
  - [Memory](./apps/mcp-hybrid-server/memory/) - Context and memory management

### 🏗️ [Infrastructure](./infrastructure/)
- **[MCP Hybrid Stack](./infrastructure/mcp-hybrid-stack/)** - AWS CDK infrastructure
  - [Constructs](./infrastructure/mcp-hybrid-stack/constructs/) - Reusable CDK constructs
  - [Stacks](./infrastructure/mcp-hybrid-stack/stacks/) - CloudFormation stack definitions

### 📦 [Packages](./packages/)
- [ESLint Config](./packages/eslint-config/) - Shared linting rules
- [TypeScript Config](./packages/typescript-config/) - Shared TypeScript configurations
- [Prettier Config](./packages/prettier-config/) - Shared code formatting rules

### 🏛️ [Architecture](./architecture/)
- [System Overview](./architecture/system-overview/) - High-level architecture
- [Design Patterns](./architecture/design-patterns/) - Architectural patterns and decisions
- [Diagrams](./architecture/diagrams/) - Visual architecture representations

### 🚀 [Deployment](./deployment/)
- [Scripts](./deployment/scripts/) - Deployment automation
- [Environments](./deployment/environments/) - Environment-specific configurations

### 📚 [API Reference](./api-reference/)
- [REST API](./api-reference/rest/) - RESTful endpoint documentation
- [MCP Protocol](./api-reference/mcp-protocol/) - Model Context Protocol specifications

### 📖 [Tutorials](./tutorials/)
- [Getting Started](./tutorials/getting-started/) - Quick start guides
- [Advanced Topics](./tutorials/advanced/) - Deep dives and advanced usage

### 🤝 [Contributing](./contributing/)
- Guidelines for contributing to the project
- Development setup and best practices

## Quick Links

- [Quick Start Guide](./tutorials/getting-started/quick-start.md)
- [Architecture Overview](./architecture/system-overview/overview.md)
- [API Documentation](./api-reference/rest/endpoints.md)
- [Deployment Guide](./deployment/scripts/deployment-guide.md)

## Getting Help

- Check our [FAQ](./tutorials/getting-started/faq.md)
- Review [Common Issues](./tutorials/getting-started/troubleshooting.md)
- Read the [Contributing Guide](./contributing/guidelines.md)