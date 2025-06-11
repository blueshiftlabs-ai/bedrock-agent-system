# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commit Management Strategy

### Automatic Commit Guidelines

Claude Code should automatically create commits throughout development sessions using conventional commit format to maintain clear project history:

**Conventional Commit Format:**

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**

- `feat`: New features or major functionality additions
- `fix`: Bug fixes and issue resolutions
- `refactor`: Code restructuring without changing external behavior
- `docs`: Documentation updates
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates, configuration changes
- `perf`: Performance improvements
- `build`: Build system or external dependency changes

**When to Commit:**

1. **Feature Completion**: After implementing a complete feature or significant functionality
2. **Logical Milestones**: When reaching a stable, working state of a component
3. **Bug Fixes**: After resolving issues or compilation errors
4. **Refactoring**: After completing code reorganization or cleanup
5. **Configuration Changes**: After updating project configuration or dependencies
6. **Before Major Changes**: Before starting risky refactoring or architectural changes

**When NOT to Commit:**

- After every single file change or minor edit
- In the middle of implementing a feature
- When code is in a broken or incomplete state
- For experimental changes that may be reverted

**Examples:**

```bash
feat(mcp-hybrid): implement WebSocket gateway for real-time dashboard communication
fix(memory-server): correct health endpoint path for server discovery
refactor(tool-registry): improve error handling with centralized error utils
docs(architecture): add comprehensive MCP hybrid server overhaul plan
chore(deps): update NestJS and related dependencies
```

**Commit Frequency**: Aim for 3-7 commits per development session, ensuring each commit represents a logical unit of work that could be reverted independently if needed.

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

### Port Strategy

See `docs/PORT_STRATEGY.md` for complete port allocation strategy.

**Key Ports:**

- **4100**: MCP Memory Server
- **4101**: MCP Hybrid Server
- **3100**: MCP Dashboard
- **5100-5104**: Local database services (DynamoDB, OpenSearch, Gremlin)

**Avoided:** Common development ports (3000-3099, 8000-8099, 9000-9099)

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
- `apps/mcp-memory-server/src/main.ts`: Memory server entry point
- `apps/mcp-memory-server/src/mcp/mcp-tools.service.ts`: Memory MCP tools
- `apps/mcp-dashboard/src/app/page.tsx`: Main dashboard interface
- `infrastructure/mcp-hybrid-stack/lib/mcp-hybrid-stack.ts`: AWS CDK infrastructure definition

## UI Development Standards

### Frontend Technology Stack

For all user interface applications in this project, use the following technology stack:

- **Framework**: Next.js 14+ with App Router (TypeScript)
- **Styling**: Tailwind CSS for utility-first styling
- **Component Library**: shadcn/ui as the base component system
- **Icons**: Lucide React for consistent iconography
- **AI Integration**: Vercel AI SDK for quick AI-powered UI features
- **State Management**: Zustand for client-side state (when needed)
- **Data Fetching**: TanStack Query (React Query) for server state management

### Component Standards

- Follow shadcn/ui design patterns and conventions
- Use TypeScript strict mode for all components
- Implement dark/light mode support with system preference detection
- Ensure responsive design (mobile-first approach)
- Maintain WCAG 2.1 AA accessibility compliance
- Use consistent spacing, colors, and typography from Tailwind CSS

### Alternative Frameworks

While Next.js + shadcn/ui is preferred for bespoke dashboards, consider these alternatives only for specific use cases:

- **Chainlit**: For rapid AI chat interfaces (if heavy conversational AI features needed)
- **Streamlit**: For data science prototyping (avoid for production UIs)
- Stick with Next.js for sophisticated, production-ready interfaces

## Memory System Architecture

### MCP Memory Server

The `mcp-memory-server` provides sophisticated memory capabilities for AI agents:

**Endpoint**: `http://localhost:4100/memory/mcp` (SSE transport)

**Storage Layers**:

- **OpenSearch**: Vector similarity search with separate text/code indexes
- **DynamoDB**: Metadata storage, session management, agent profiles  
- **Neptune**: Knowledge graph for memory relationships and connections

**Memory Types**:

- **Episodic**: Conversation histories and events
- **Semantic**: Learned patterns, best practices, concepts
- **Procedural**: Code patterns, workflows, strategies
- **Working**: Temporary memory with TTL support

### Project-Based Memory Isolation

Memories are organized by project context to prevent cross-contamination:

- **Project Memories**: Isolated to specific project contexts
- **General/Common Memories**: Accessible across all projects (named "general" or "common")
- **Cross-Project Search**: Capability to search other projects when explicitly requested
- **Environment Configuration**: Project name set via environment variable `PROJECT_NAME`

**Configuration**:

```bash
# Memory Server Project Configuration
PROJECT_NAME=bedrock-agent-system  # Current project
ALLOW_CROSS_PROJECT_ACCESS=true    # Enable searching other projects
DEFAULT_PROJECT=general           # Fallback project for common memories
```

### Memory Dashboard Applications

**MCP Dashboard** (`apps/mcp-dashboard`):

- Monitors overall system health including memory server status
- Shows memory server connection, storage health, and basic statistics
- General MCP server management and monitoring

**Memory Dashboard** (`apps/mcp-memory-dashboard` - planned):

- Dedicated memory visualization and management interface
- Interactive knowledge graph similar to Neo4j Browser
- Memory browser, analytics, and agent management
- Built with Next.js + shadcn/ui + D3.js for graph visualization

### Memory Tools Available

1. `store-memory` - Store memories with automatic analysis
2. `retrieve-memories` - Semantic search with filtering
3. `add-connection` - Create knowledge graph relationships
4. `create-observation` - Store agent observations with linking
5. `consolidate-memories` - Deduplicate and merge memories
6. `delete-memory` - Remove memories from all storage layers
7. `get-memory-statistics` - Analytics and metrics

## Memory Server Development & Testing

### Development Modes

**Local Development (JSON Storage)**:

```bash
# Start memory server with local JSON storage
pnpm memory:dev:local
# OR with turbo
pnpm turbo run --filter=@apps/mcp-memory-server dev:local
```

**Server Development (DynamoDB)**:

```bash
# Start local databases first
pnpm memory:local:up
# Start memory server with DynamoDB
pnpm memory:dev:server
```

**Production Mode**:

```bash
pnpm memory:start:prod
```

### Health Check & Testing

**Quick Health Check**:

```bash
# Basic server health
curl http://localhost:4100/health

# Memory-specific health with storage details
curl http://localhost:4100/memory/health
```

**Expected Health Response**:

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "memory": {
    "opensearch": { "status": "connected", "endpoint": "http://localhost:5102" },
    "storage": { "type": "local", "status": "ok" },
    "neptune": { "status": "connected", "endpoint": "ws://localhost:5103" }
  },
  "mcp": {
    "transport": "sse",
    "endpoint": "/memory/mcp",
    "tools_registered": 7
  }
}
```

**MCP Tool Testing**:

```bash
# Test store-memory tool via HTTP
curl -X POST http://localhost:4100/memory/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "store-memory",
      "arguments": {
        "content": "This is a test memory for the bedrock-agent-system project",
        "type": "episodic",
        "project": "bedrock-agent-system",
        "tags": ["test", "development"]
      }
    }
  }'

# Test retrieve-memories tool
curl -X POST http://localhost:4100/memory/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "retrieve-memories",
      "arguments": {
        "query": "test memory",
        "project": "bedrock-agent-system",
        "limit": 5
      }
    }
  }'
```

### Troubleshooting Common Issues

**Memory Server Won't Start**:

1. Check port 4100 availability: `lsof -i :4100`
2. Verify environment variables in `.env.local`
3. Check database connectivity (OpenSearch: 5102, Gremlin: 5103)

**Storage Connection Issues**:

```bash
# Test OpenSearch
curl http://localhost:5102/_cluster/health

# Test Gremlin (requires websocket client)
# Check docker logs: docker logs opensearch-node01
```

**Memory Operations Failing**:

1. Check memory server logs for detailed error messages
2. Verify project context is correctly set
3. Test with simple memory storage first
4. Check embedding service status for semantic search issues

### Local Database Setup

```bash
# Start all local databases for memory server
pnpm memory:local:up

# Check database status
docker ps | grep -E "(opensearch|gremlin|dynamodb)"

# View logs
pnpm memory:local:logs

# Stop databases
pnpm memory:local:down
```

### Memory Dashboard Integration

The MCP Dashboard monitors memory server health automatically. If the dashboard shows memory server as unhealthy:

1. Use health check endpoints above to diagnose
2. Check memory server logs: `pnpm memory:dev:local` (with verbose logging)
3. Verify all database dependencies are running
4. Test individual MCP tools with curl commands
5. Check WebSocket connection in dashboard Network tab

### Performance Testing

**Load Testing Memory Operations**:

```bash
# Store 100 test memories
for i in {1..100}; do
  curl -X POST http://localhost:4100/memory/mcp \
    -H "Content-Type: application/json" \
    -d "{\"method\": \"tools/call\", \"params\": {\"name\": \"store-memory\", \"arguments\": {\"content\": \"Test memory $i for performance testing\", \"type\": \"episodic\", \"project\": \"bedrock-agent-system\"}}}"
done

# Test retrieval performance
time curl -X POST http://localhost:4100/memory/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/call", "params": {"name": "retrieve-memories", "arguments": {"query": "performance testing", "project": "bedrock-agent-system", "limit": 50}}}'
```

## Current Implementation Status & Key File References

### Working Systems (Deployed & Active)

**MCP Memory Server** - Production Ready ✅

- **Location**: `apps/mcp-memory-server/`
- **Port**: 4100 (<http://localhost:4100/memory/mcp>)
- **Status**: Active, working with Claude Desktop, MCP Inspector accessible
- **Key Files**:
  - `apps/mcp-memory-server/src/main.ts` - Server entry point
  - `apps/mcp-memory-server/src/mcp/mcp-tools.service.ts` - MCP tools implementation
  - `apps/mcp-memory-server/src/services/embedding.service.ts` - Bedrock embeddings (respects BEDROCK_ENABLED flag)
- **Available Tools**: store-memory, retrieve-memories, add-connection, create-observation, consolidate-memories, delete-memory, get-memory-statistics
- **Transport**: SSE (Server-Sent Events)

**MCP Dashboard** - Production Ready ✅

- **Location**: `apps/mcp-dashboard/`
- **Port**: 3100 (<http://localhost:3100>)
- **Status**: Active, monitors memory server health and provides MCP server management
- **Key Files**:
  - `apps/mcp-dashboard/src/app/page.tsx` - Main dashboard interface
  - `apps/mcp-dashboard/src/components/dashboard/dashboard-overview.tsx` - Overview component
  - `apps/mcp-dashboard/src/components/servers/mcp-server-management.tsx` - Server management

### In Development Systems

**Distributed MCP Architecture** - Under Development 🚧

- **Location**: `apps/mcp-memory-orchestrator/`, `docker-compose.distributed-mcp.yml`
- **Port Range**: 4200-4203 (following sophisticated port strategy)
- **Status**: Core infrastructure implemented, external MCP servers not yet integrated
- **Key Files**:
  - `apps/mcp-memory-orchestrator/src/memory-orchestrator/memory-orchestrator.service.ts` - Orchestration logic
  - `apps/mcp-memory-orchestrator/src/clients/mcp-client.service.ts` - MCP client coordination
  - `docker-compose.distributed-mcp.yml` - Complete distributed environment
  - `config/genai-toolbox-config.yaml` - PostgreSQL tool configuration
  - `database/init.sql` - PostgreSQL schema initialization
- **Planned Tools**: store-comprehensive-memory, retrieve-comprehensive-memories, create-memory-connection, get-memory-statistics
- **Architecture**: Coordinates OpenSearch MCP (4201), PostgreSQL MCP (4202), Neo4j MCP (4203)

### Architecture Documentation

**Key Strategy Documents**:

- `docs/PORT_STRATEGY.md` - Sophisticated port allocation strategy (4100=core, 4200=distributed, etc.)
- `docs/architecture/MCP_ECOSYSTEM_PIVOT_STRATEGY.md` - Strategy for using official MCP servers
- `docs/architecture/LOCAL_VS_DISTRIBUTED_MCP_ARCHITECTURE.md` - Architecture comparison
- `docs/implementation/DISTRIBUTED_MCP_IMPLEMENTATION_PLAN.md` - Detailed implementation plan

**Implementation Progress Documents**:

- `docs/implementation/MCP_HYBRID_SERVER_PROGRESS.md` - Progress tracking
- `docs/implementation/MEMORY_SERVER_FIX_PLAN.md` - Previous fixes applied

### Development Commands Reference

**Working Memory Server**:

```bash
# Health check
curl http://localhost:4100/health

# Memory health with storage details  
curl http://localhost:4100/memory/health

# Test memory storage (available as MCP tool to Claude)
curl -X POST http://localhost:4100/memory/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/call", "params": {"name": "store-memory", "arguments": {"content": "Test memory", "type": "episodic", "project": "bedrock-agent-system"}}}'
```

**Distributed Architecture**:

```bash
# Start core databases + orchestrator
cd /home/acoose/projects/bedrock-agent-system
docker-compose -f docker-compose.distributed-mcp.yml up -d opensearch postgresql neo4j memory-orchestrator

# Check orchestrator health
curl http://localhost:4200/health

# Test orchestrator MCP tools (inside container)
docker-compose -f docker-compose.distributed-mcp.yml exec memory-orchestrator curl -X POST http://localhost:4100/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Next Steps & Immediate Tasks

1. **Complete Distributed MCP Integration**: Research and integrate actual OpenSearch, GenAI Toolbox, and Neo4j MCP server images
2. **Test End-to-End Distributed Operations**: Verify memory storage across all three systems
3. **Memory System Dogfooding**: Use available memory tools to store implementation context and decisions
4. **Documentation Updates**: Update implementation progress documents as features are completed

### MCP Server Configuration & Backup Strategy

**Critical Issue**: Claude Code occasionally loses MCP server configurations during crashes/restarts.

**Backup System**:
- **Auto-backup script**: `scripts/backup-claude-config.sh` 
- **Manual backup**: Run script before major changes
- **Restore command**: `cp .mcp-backups/claude-config-TIMESTAMP.json ~/.claude.json`

**Global MCP Servers** (user-level, available in all projects):
- `memory-local`: http://localhost:4100/memory/sse (SSE transport)
- `sequential-thinking`: npx -y @modelcontextprotocol/server-sequential-thinking
- `filesystem`: npx -y @modelcontextprotocol/server-filesystem /home/acoose/projects
- `time`: npx -y @modelcontextprotocol/server-time
- `github`: npx -y @modelcontextprotocol/server-github
- `puppeteer`: npx -y @modelcontextprotocol/server-puppeteer
- `awslabs-core`: uvx awslabs.core-mcp-server@latest
- `context7`: npx -y @upstash/context7-mcp

**Quick Recovery**:
```bash
# If MCP servers disappear again, run:
claude mcp add "memory-local" "http://localhost:4100/memory/sse" -t sse -s user
claude mcp add "sequential-thinking" "npx" -s user -- "-y" "@modelcontextprotocol/server-sequential-thinking"
claude mcp add "filesystem" "npx" -s user -- "-y" "@modelcontextprotocol/server-filesystem" "/home/acoose/projects"
claude mcp add "github" "npx" -s user -- "-y" "@modelcontextprotocol/server-github"
# (etc. - see backup files for complete list)
```

### Important Notes for Claude Code

- **Always use the memory tools available** - The memory server at 4100 is registered and working globally
- **Follow port strategy strictly** - 4100=core, 4200=distributed, avoid lazy +1 incrementing
- **Commit frequently with conventional commits** - Prevent context loss and maintain clear history
- **Update CLAUDE.md regularly** - Keep implementation status current to prevent confusion
- **Backup before major changes** - Run `scripts/backup-claude-config.sh` before risky operations
