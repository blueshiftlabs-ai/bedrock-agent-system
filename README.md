# MCP Memory Server

A production-ready Memory Context Protocol (MCP) server with sophisticated memory management, vector search, graph relationships, and real-time monitoring dashboard.

## 🚀 Overview

The MCP Memory Server provides a comprehensive memory management system for AI agents and applications, implementing the Model Context Protocol standard with advanced features:

- **Multi-layer Storage**: DynamoDB (metadata), OpenSearch (vector search), Neo4j (graph relationships)
- **Semantic Search**: Vector similarity search with automatic embedding generation
- **Knowledge Graph**: Connect memories with relationships for enhanced context retrieval
- **Real-time Dashboard**: Monitor memory operations, browse memories, visualize connections
- **MCP Compliance**: Full implementation of the Memory Context Protocol standard

## 📦 Core Applications

### MCP Memory Server (`apps/mcp-memory-server`)
NestJS backend implementing the MCP protocol with:
- Memory storage with automatic semantic processing
- Vector similarity search using OpenSearch
- Graph-based memory relationships via Neo4j
- RESTful and MCP protocol APIs
- Health monitoring and observability

### Memory Dashboard (`apps/mcp-memory-server-dashboard`)
Next.js 15 dashboard with:
- Real-time memory browsing with infinite scroll
- Interactive knowledge graph visualization
- Agent management and activity monitoring
- Storage health monitoring
- Memory statistics and analytics

## 🏗️ Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│   MCP Clients      │     │    Web Dashboard     │
│  (AI Agents, CLI)  │     │    (Next.js 15)      │
└──────────┬─────────┘     └───────────┬──────────┘
           │                           │
           │ MCP Protocol              │ REST/WebSocket
           │                           │
        ┌──┴───────────────────────────┴──┐
        │       MCP Memory Server         │
        │         (NestJS)                │
        └─────────────┬────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────┴────┐  ┌────┴────┐  ┌────┴────┐
   │DynamoDB │  │OpenSearch│  │ Neo4j   │
   │(Metadata)│  │(Vectors) │  │(Graph)  │
   └─────────┘  └──────────┘  └─────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm 10+
- Docker & Docker Compose
- AWS credentials (for DynamoDB)

### Installation

```bash
# Clone the repository
git clone https://github.com/blueshiftlabs-ai/bedrock-agent-system.git
cd bedrock-agent-system

# Install dependencies
pnpm install

# Start infrastructure services (OpenSearch, Neo4j)
docker-compose up -d

# Start the memory server
pnpm --filter @apps/mcp-memory-server dev

# In another terminal, start the dashboard
pnpm --filter @apps/mcp-memory-server-dashboard dev
```

### Access Points
- **Memory Server**: http://localhost:4100
- **Dashboard**: http://localhost:3101
- **MCP Endpoint**: http://localhost:4100/mcp

## 🛠️ Development

### Project Structure
```
.
├── apps/
│   ├── mcp-memory-server/          # Backend MCP server
│   └── mcp-memory-server-dashboard/ # Frontend dashboard
├── packages/
│   ├── eslint-config/              # Shared ESLint configuration
│   ├── prettier-config/            # Shared Prettier configuration
│   └── typescript-config/          # Shared TypeScript configuration
└── docker-compose.yml              # Local infrastructure
```

### Available Commands

```bash
# Development
pnpm dev                    # Run all apps in development mode
pnpm build                  # Build all apps
pnpm test                   # Run tests
pnpm lint                   # Lint all code

# App-specific commands
pnpm --filter @apps/mcp-memory-server dev
pnpm --filter @apps/mcp-memory-server-dashboard dev
```

## 📚 MCP Protocol Implementation

The server implements the full MCP protocol for memory operations:

### Available Tools

- `store-memory` - Store memories with semantic processing
- `retrieve-memories` - Search memories using vector similarity
- `add-connection` - Create relationships between memories
- `create-observation` - Synthesize insights from multiple memories
- `consolidate-memories` - Merge similar memories
- `get-memory-statistics` - Analytics and usage metrics

### Example Usage

```javascript
// Store a memory
await mcp.call('store-memory', {
  content: 'Implementation decision for infinite scroll',
  type: 'procedural',
  project: 'my-project',
  tags: ['frontend', 'performance']
});

// Retrieve related memories
const memories = await mcp.call('retrieve-memories', {
  query: 'infinite scroll performance',
  limit: 10,
  include_related: true
});
```

## 🚀 Production Deployment

### Docker Deployment

```bash
# Build production images
docker build -t mcp-memory-server ./apps/mcp-memory-server
docker build -t mcp-dashboard ./apps/mcp-memory-server-dashboard

# Run with docker-compose
docker-compose -f docker-compose.production.yml up
```

### Environment Variables

#### Memory Server
```env
NODE_ENV=production
PORT=4100
DYNAMODB_TABLE_NAME=mcp-memories
OPENSEARCH_ENDPOINT=https://your-opensearch.amazonaws.com
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
```

#### Dashboard
```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_WS_URL=wss://api.your-domain.com
```

## 📊 Monitoring & Observability

- **Health Endpoints**: `/health`, `/health/ready`, `/health/live`
- **Metrics**: Request latency, memory operations, storage health
- **Logging**: Structured JSON logging with correlation IDs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🔗 Links

- [GitHub Project Board](https://github.com/orgs/blueshiftlabs-ai/projects/1)
- [Documentation](./docs)
- [Model Context Protocol](https://modelcontextprotocol.com)

---

Built with ❤️ for the MCP community