# MCP Hybrid Server Documentation

## Overview

The MCP Hybrid Server is the core application of the Bedrock Agent System, built with NestJS and LangGraph to provide production-scale microservice transformation and analysis capabilities.

## Core Components

### [Agents](./agents/)
Specialized AI agents for different analysis tasks:
- [Base Agent](./agents/base/) - Core agent functionality
- [Code Analyzer](./agents/code-analyzer/) - Source code analysis
- [Database Analyzer](./agents/db-analyzer/) - Database schema and query analysis
- [Documentation Generator](./agents/documentation-generator/) - Automated documentation creation
- [Knowledge Builder](./agents/knowledge-builder/) - Knowledge graph construction

### [Tools](./tools/)
MCP-compliant tools for various operations:
- [Tool Implementations](./tools/implementations/) - Individual tool implementations
- [Tool Registry](./tools/registry/) - Dynamic tool registration system

### [Workflows](./workflows/)
LangGraph-based orchestration:
- [Workflow Graphs](./workflows/graphs/) - Workflow definitions
- [Workflow Nodes](./workflows/nodes/) - Individual workflow steps
- [Workflow Services](./workflows/services/) - Supporting services
- [Workflow States](./workflows/states/) - State management

### [Integrations](./integrations/)
External service integrations:
- [Bedrock Integration](./integrations/bedrock/) - AWS Bedrock AI services
- [LangChain Integration](./integrations/langchain/) - LangChain framework integration

### [AWS Services](./aws/)
AWS service configurations and utilities

### [Common Utilities](./common/)
Shared components:
- [Filters](./common/filters/) - Exception handling
- [Guards](./common/guards/) - Route protection
- [Interceptors](./common/interceptors/) - Request/response interception
- [Pipes](./common/pipes/) - Data transformation

## Getting Started

1. [Installation Guide](../../tutorials/getting-started/installation.md)
2. [Configuration](./config/)
3. [Running the Server](../../tutorials/getting-started/running-server.md)

## Architecture

For detailed architecture information, see the [Architecture Documentation](../../architecture/system-overview/mcp-server-architecture.md).