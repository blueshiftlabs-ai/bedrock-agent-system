# MCP Memory Server

A sophisticated memory server implementing the Model Context Protocol (MCP) with support for multi-layer storage, semantic understanding, and graph relationships. Designed for AI agents to store, retrieve, and connect memories across different contexts and projects.

## 🚀 Current Status

**✅ Production Ready** - Fully operational with 36+ stored memories and all 9 MCP tools working.

- **Port**: 4100 (`http://localhost:4100/memory/mcp`)
- **Transport**: HTTP + SSE (both working)
- **Storage**: Local JSON + DynamoDB + Neo4j graph (with automatic fallback strategy)
- **Tools**: All 9 MCP tools operational and tested
- **Project Isolation**: Supports multi-project memory organization

## 🧠 Memory Types

The server supports four sophisticated memory types based on cognitive science:

### 1. **Episodic Memory** (`episodic`)

Memories of specific events, conversations, and temporal experiences.

**Use Cases**:

- Conversation histories
- User interactions
- Project milestones
- Time-specific events

**Example**:

```json
{
  "content": "User requested to implement dark mode toggle in the settings page during our architecture discussion",
  "type": "episodic",
  "agent_id": "claude-code",
  "session_id": "architecture-review-2025-01",
  "tags": ["user-request", "dark-mode", "settings", "ui"]
}
```

### 2. **Semantic Memory** (`semantic`)

General knowledge, concepts, and factual information without temporal context.

**Use Cases**:

- Code patterns and best practices
- Technical concepts
- System architectures
- General knowledge

**Example**:

```json
{
  "content": "React hooks allow functional components to have state and lifecycle methods. useState manages local state, useEffect handles side effects.",
  "type": "semantic",
  "tags": ["react", "hooks", "frontend", "concepts"]
}
```

### 3. **Procedural Memory** (`procedural`)

Step-by-step processes, workflows, and how-to knowledge.

**Use Cases**:

- Implementation procedures
- Deployment workflows
- Problem-solving processes
- Code patterns

**Example**:

```json
{
  "content": "To implement MCP tools: 1) Define tool with @Tool decorator, 2) Add zod schema for parameters, 3) Implement async method, 4) Register in module",
  "type": "procedural",
  "content_type": "text",
  "tags": ["mcp", "implementation", "workflow", "tools"]
}
```

### 4. **Working Memory** (`working`)

Temporary, context-specific memories with optional TTL (Time To Live).

**Use Cases**:

- Current task context
- Temporary calculations
- Session-specific data
- Short-term planning

**Example**:

```json
{
  "content": "Currently debugging the memory statistics function - issue seems to be in local storage data aggregation",
  "type": "working",
  "ttl": "2025-06-09T00:00:00Z",
  "session_id": "debug-session-001"
}
```

## 🛠 Available MCP Tools

The server provides 9 comprehensive MCP tools:

### Core Memory Operations

1. **`store-memory`** - Store memories with automatic semantic analysis
2. **`retrieve-memories`** - Search and retrieve memories with filtering
3. **`delete-memory`** - Remove memories and all relationships

### Graph & Relationships

4. **`add-connection`** - Create relationships between memories
5. **`retrieve-connections`** - Get graph connections between memories
6. **`connections-by-entity`** - Get all connections for specific entities

### Advanced Operations

7. **`create-observation`** - Store observations and link to related memories
8. **`consolidate-memories`** - Merge similar memories to reduce redundancy
9. **`get-memory-statistics`** - Get comprehensive memory analytics

## 📊 Memory Statistics Example

Current system metrics (as of latest deployment):

```json
{
  "storage": {
    "total_memories": 36,
    "text_memories": 35,
    "code_memories": 1,
    "by_type": {
      "semantic": {"count": 14},
      "episodic": {"count": 10}, 
      "procedural": {"count": 12}
    },
    "by_agent": {
      "claude-code": {"count": 20},
      "test-agents": {"count": 8}
    },
    "by_project": {
      "bedrock-agent-system": {"count": 33},
      "common": {"count": 3}
    }
  },
  "graph": [
    {
      "concept_id": "concept_code-style",
      "name": "code-style", 
      "confidence": 0.3,
      "related_memories": ["mem_1749411881726_776e93ea", "..."]
    }
  ]
}
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Local Services (Docker Compose)
```bash
# Start all local services (DynamoDB, Neo4j, OpenSearch)
pnpm run memory:local:up

# Check service status
pnpm run memory:local:status

# View logs
pnpm run memory:local:logs
```

### 3. Start the Memory Server

```bash
# Local development mode (recommended)
pnpm run dev:local

# Or using turbo from project root
pnpm turbo run --filter=@apps/mcp-memory-server dev:local

# Or start services + server in one command
pnpm run local:dev
```

### 4. Verify Server Health

```bash
curl http://localhost:4100/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-06-08T20:30:00.000Z",
  "memory": {
    "storage": {"type": "local", "status": "ok"},
    "graph": {"status": "connected", "endpoint": "bolt://localhost:7687"}
  },
  "mcp": {
    "transport": "http",
    "endpoint": "/memory/mcp",
    "tools_registered": 9
  }
}
```

### 4. Test Memory Operations

**Store a Memory**:

```bash
curl -X POST http://localhost:4100/memory/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "store-memory",
      "arguments": {
        "content": "Testing MCP memory server - stores episodic memories with project isolation and semantic analysis",
        "type": "episodic",
        "content_type": "text",
        "agent_id": "test-user",
        "session_id": "getting-started",
        "project": "my-project",
        "tags": ["testing", "mcp", "memory-server"]
      }
    }
  }'
```

**Retrieve Memories**:

```bash
curl -X POST http://localhost:4100/memory/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "retrieve-memories",
      "arguments": {
        "agent_id": "test-user",
        "project": "my-project",
        "limit": 5
      }
    }
  }'
```

**Get Statistics**:

```bash
curl -X POST http://localhost:4100/memory/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get-memory-statistics",
      "arguments": {}
    }
  }'
```

## 🏗 Development Modes

### 🏠 Local Development Mode (Current)

Perfect for development and testing:

```bash
pnpm run dev:local
```

**Features:**

- ✅ Local JSON file storage (`.local-memory-db/memory-metadata.json`)
- ✅ Neo4j graph integration (if available)
- ✅ All 9 MCP tools working
- ✅ Project isolation support
- ✅ Automatic semantic analysis (topics, entities, sentiment)
- ✅ HTTP transport (SSE disabled for compatibility)

### 🌐 Server Development Mode

For development with AWS services:

```bash
pnpm run dev:server
```

**Features:**

- DynamoDB for metadata storage
- OpenSearch for vector similarity
- Neptune for graph relationships  
- AWS Bedrock embeddings

### 🚀 Production Mode

```bash
pnpm run start:prod
```

## 📁 Project Isolation

The memory server supports project-based memory isolation:

- **Default Project**: `"common"` - Shared across all projects
- **Project-Specific**: Memories tagged with specific project names
- **Cross-Project Search**: Available when explicitly requested

**Example Projects in Current System**:

- `bedrock-agent-system` (33 memories)
- `common` (3 memories)

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY_MODE` | `local` | Storage mode (`local` or `server`) |
| `PROJECT_NAME` | `bedrock-agent-system` | Current project context |
| `ALLOW_CROSS_PROJECT_ACCESS` | `true` | Enable cross-project search |
| `NEO4J_URI` | `bolt://localhost:7687` | Neo4j connection string |
| `NEO4J_USERNAME` | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | `memory` | Neo4j password |

### Local Storage Structure

```
apps/mcp-memory-server/
├── .local-memory-db/
│   ├── memory-metadata.json    # Memory metadata storage
│   ├── memory-content.json     # Memory content storage  
│   └── sessions.json           # Session management
```

## 🔍 Advanced Features

### Semantic Analysis

Automatic extraction of:

- **Topics**: Key concepts from content
- **Entities**: Named entities and important terms
- **Sentiment**: Positive, negative, or neutral
- **Programming Language**: For code content
- **Functions & Imports**: For code analysis

### Graph Relationships

- Automatic concept clustering based on tags
- Manual relationship creation between memories
- Graph traversal for related memory discovery
- Connection confidence scoring

### Content Type Detection

Automatic detection between:

- **Text**: Natural language content
- **Code**: Programming code with syntax analysis

## 🧪 Testing & Validation

### Health Checks

```bash
# Basic health
curl http://localhost:4100/health

# Memory-specific health
curl http://localhost:4100/memory/health

# Statistics
curl -X POST http://localhost:4100/memory/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get-memory-statistics","arguments":{}}}'
```

### MCP Inspector Integration

The server is compatible with [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector http://localhost:4100/memory/mcp
```

### Claude Desktop Integration

Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "memory-server": {
      "command": "node",
      "args": ["dist/main.js"],
      "cwd": "/path/to/bedrock-agent-system/apps/mcp-memory-server",
      "env": {
        "MEMORY_MODE": "local",
        "PROJECT_NAME": "my-project"
      }
    }
  }
}
```

## 📊 Local Development Monitoring

The memory server provides several monitoring interfaces for local development:

### Database Monitoring URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **DynamoDB Admin** | http://localhost:5101 | Browse DynamoDB tables and data |
| **OpenSearch Dashboards** | http://localhost:5104 | Query vector embeddings and indices |
| **Neo4j Browser** | http://localhost:7474 | Explore knowledge graph relationships |
| **Memory Server Health** | http://localhost:4100/memory/health | Overall system health status |

### Credentials

- **DynamoDB Admin**: No authentication required
- **OpenSearch Dashboards**: No authentication required (security disabled)
- **Neo4j Browser**: Username: `neo4j`, Password: `password`

### Monitoring Memory Storage

#### View Stored Memories (DynamoDB)
1. Open http://localhost:5101
2. Navigate to `MemoryMetadata` table
3. Browse memory records with metadata, tags, topics

#### Query Vector Embeddings (OpenSearch)
1. Open http://localhost:5104
2. Go to Dev Tools
3. Query memory indices:
```json
GET memory-text/_search
{
  "query": {
    "match_all": {}
  }
}
```

#### Explore Knowledge Graph (Neo4j)
1. Open http://localhost:7474
2. Login with `neo4j/password`
3. Query memory nodes:
```cypher
MATCH (m:Memory) RETURN m LIMIT 25
```

4. Find relationships:
```cypher
MATCH (m:Memory)-[r]->(n) RETURN m, r, n LIMIT 50
```

### Useful Cypher Queries

```cypher
// Find all memories by agent
MATCH (a:Agent {agent_id: "claude-code"})-[:CREATED]->(m:Memory)
RETURN m

// Find concept clusters
MATCH (c:Concept)-[:RELATED_TO]->(m:Memory)
RETURN c.name, count(m) as memory_count
ORDER BY memory_count DESC

// Find memory connections
MATCH (m1:Memory)-[r:RELATES_TO]->(m2:Memory)
RETURN m1.content, r.relationship_type, m2.content
```

### Debug Commands

```bash
# Check all services status
pnpm run memory:local:status

# View service logs
pnpm run memory:local:logs

# Test memory operations
curl -X POST http://localhost:4100/memory/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get-memory-statistics","arguments":{}}}'
```

## 🔮 Roadmap & Future Enhancements

### Phase 2: MCP Ecosystem Integration

- Replace local JSON with [GenAI Toolbox](https://github.com/googleapis/genai-toolbox) PostgreSQL MCP server
- Use official Neo4j MCP servers instead of custom implementation
- Full container orchestration with Docker Compose

### Phase 3: Advanced Features

- Vector similarity search with OpenSearch MCP server
- Memory consolidation algorithms
- Cross-project memory recommendations
- Advanced graph analytics

## 🐛 Troubleshooting

### Common Issues

**Port 4100 in use:**

```bash
# Check what's using the port
lsof -i :4100

# Kill the process if needed
kill -9 <PID>
```

**Neo4j connection failed:**
The server continues working without graph features if Neo4j is unavailable.

**Memory tools not working:**
Ensure proper JSON-RPC format with `Accept: application/json, text/event-stream` header.

**Empty retrieve results:**

- Check project isolation settings
- Verify agent_id and session_id filters
- Use get-memory-statistics to see available data

### Debug Mode

```bash
# Enable debug logging
DEBUG=memory:* pnpm run dev:local
```

## 📊 Current Statistics

As of latest deployment:

- **36 total memories** stored and retrievable
- **9 MCP tools** fully operational
- **4 memory types** supported with rich metadata
- **2+ projects** with isolation working
- **Zero data loss** during development sessions

## 🤝 Contributing

See the main project documentation for contribution guidelines. The memory server follows functional programming principles:

- No `if` statements (use strategy patterns)
- No mutations (prefer `map`, `filter`, `reduce`)
- Expressions over statements
- Pure functions where possible

## 📝 License

See the main project LICENSE file.

---

**Status**: ✅ Production Ready  
**Last Updated**: 2025-06-08  
**Version**: 1.0.0-local  
**MCP Protocol**: Compatible
