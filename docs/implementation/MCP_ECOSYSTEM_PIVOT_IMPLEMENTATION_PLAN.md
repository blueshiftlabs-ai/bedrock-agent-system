# MCP Ecosystem Pivot Implementation Plan

## Current State Assessment

### ✅ Working Components (Port 4100)

**MCP Memory Server**: Fully operational with 35 stored memories

- **Transport**: HTTP, SSE
- **Storage**: Local JSON (.local-memory-db/memory-metadata.json)
- **Graph**: Neo4j integration working
- **Tools**: All 9 MCP tools operational and tested
  - store-memory, retrieve-memories, get-memory-statistics
  - add-connection, create-observation, consolidate-memories
  - delete-memory, retrieve-connections, connections-by-entity

**Statistics** (as of this assessment):

- 35 total memories (34 text, 1 code)
- Types: 14 semantic, 9 episodic, 11 procedural  
- Agents: 19 claude-code memories + test agents
- Graph: 4 concept clusters (code-style, guidelines, etc.)
- Project isolation: 32 bedrock-agent-system, 3 common

### 🔄 Issues to Address

1. **Local JSON Storage**: Should be replaced with proper MCP servers
2. **Custom Neo4j Service**: Should use official Neo4j MCP servers  
3. **Missing Container Stack**: No DynamoDB local, OpenSearch, or Neo4j containers running
4. **Transport Layer**: Need to ensure compatibility with official MCP ecosystem

## Implementation Strategy

### Phase 1: Immediate Stability (Current Session)

**Objective**: Keep current system working while documenting architecture

**Actions**:

- ✅ Fix get-memory-statistics (COMPLETED - now returns full data)
- ✅ Document current state using memory tools
- 🔄 Test memory server with enterprise documentation scenarios
- Create fallback mechanism when connections fail

**Success Criteria**:

- All 9 MCP tools continue working
- Memory statistics show actual data (not empty)
- System remains stable for documentation work

### Phase 2: MCP Ecosystem Integration (Next Session)

**Objective**: Replace custom implementations with official MCP servers

#### 2.1 Storage Layer Replacement

**Current**: Local JSON file storage
**Target**: GenAI Toolbox PostgreSQL MCP Server

```yaml
# Replace apps/mcp-memory-server/src/services/local-storage.service.ts with:
genai_toolbox_config:
  postgres:
    host: localhost
    port: 5432
    database: mcp_memory
    schemas:
      - memory_metadata
      - memory_content
      - session_management
```

**Benefits**:

- SQL queries via MCP tools
- ACID transactions
- Proper relational data modeling
- No custom storage logic

#### 2.2 Graph Layer Replacement

**Current**: Custom Neo4j service (src/services/neo4j-graph.service.ts)
**Target**: Official Neo4j MCP Server

```bash
# Use existing Neo4j MCP servers from ecosystem
npm install @neo4j/mcp-server
# OR
Use community Neo4j MCP implementations
```

**Benefits**:

- Maintained by Neo4j team
- Standard Cypher query tools
- Better performance optimizations
- No custom graph logic

#### 2.3 Vector Search Strategy

**Current**: Custom OpenSearch integration
**Target**: Defer to future / Use existing PostgreSQL pgvector

**Rationale**:

- OpenSearch MCP is experimental
- PostgreSQL with pgvector extension sufficient for MVP
- Focus on core MCP ecosystem first

### Phase 3: Container Orchestration (Future)

**Objective**: Dockerized development environment

```yaml
# docker-compose.mcp-ecosystem.yml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: mcp_memory
      POSTGRES_USER: mcp
      POSTGRES_PASSWORD: memory
    ports:
      - "5432:5432"
      
  neo4j:
    image: neo4j:5.15
    environment:
      NEO4J_AUTH: neo4j/memory
    ports:
      - "7474:7474"
      - "7687:7687"
      
  genai-toolbox:
    image: googleapis/genai-toolbox:latest
    environment:
      POSTGRES_URL: postgres://mcp:memory@postgres:5432/mcp_memory
    ports:
      - "4201:8080"  # Following port strategy
      
  neo4j-mcp:
    image: neo4j/mcp-server:latest
    environment:
      NEO4J_URI: bolt://neo4j:7687
    ports:
      - "4202:8080"
```

## Port Strategy Compliance

**Existing Strategy**:

- 4100: Core MCP Memory Server ✅
- 4200-4299: Distributed MCP architecture

**New Allocations**:

- 4201: GenAI Toolbox (PostgreSQL MCP)
- 4202: Neo4j MCP Server
- 4203: Reserved for future OpenSearch MCP

## Migration Path

### 1. Data Migration

```typescript
// Migration script: scripts/migrate-json-to-postgres.ts
export async function migrateJsonToPostgres() {
  const jsonData = await readLocalMemoryFile();
  const pgMcpClient = new PostgresMcpClient('http://localhost:4201');
  
  for (const memory of jsonData) {
    await pgMcpClient.callTool('insert-memory', {
      table: 'memory_metadata',
      data: transformMemoryFormat(memory)
    });
  }
}
```

### 2. Tool Remapping

```typescript
// Current: this.localStorageService.getAllMemoryMetadata()
// New: this.pgMcpClient.callTool('query-memories', { filters: {} })

// Current: this.neo4jService.addConnection()  
// New: this.neo4jMcpClient.callTool('create-relationship', { ... })
```

### 3. Fallback Strategy

```typescript
const storageStrategies = {
  postgres: () => this.pgMcpClient.isAvailable(),
  dynamodb: () => this.dynamoDbService.healthCheck(),
  local: () => true // Always available fallback
};

const chosenStrategy = Object.keys(storageStrategies)
  .find(strategy => storageStrategies[strategy]()) || 'local';
```

## Dogfooding Opportunities

**Use Case**: Document this implementation plan using our own memory tools

```bash
# Store each phase as procedural memory
store-memory "Phase 1: Stability - Keep current JSON storage working while testing enterprise scenarios"
store-memory "Phase 2: Integration - Replace with GenAI Toolbox PostgreSQL and official Neo4j MCP"
store-memory "Phase 3: Orchestration - Docker compose with full MCP ecosystem"

# Create connections between phases
add-connection phase1-memory-id phase2-memory-id "LEADS_TO"
add-connection phase2-memory-id phase3-memory-id "LEADS_TO"

# Store architectural decisions
store-memory "Decision: Use GenAI Toolbox PostgreSQL instead of custom storage - provides SQL MCP tools, ACID compliance, eliminates custom code"
store-memory "Decision: Use official Neo4j MCP server instead of custom service - better maintenance, standard tools, community support"
```

## Success Metrics

### Technical Metrics

- [ ] All 9 MCP tools working with new backends
- [ ] <100ms response time for memory operations
- [ ] Zero data loss during migration
- [ ] Compatibility with MCP Inspector

### Ecosystem Metrics  

- [ ] Uses ≥3 official MCP servers (not custom implementations)
- [ ] Compatible with standard MCP ecosystem tools
- [ ] Follows MCP protocol specifications exactly
- [ ] Can integrate with other MCP ecosystem projects

### User Experience Metrics

- [ ] Single command startup (`pnpm mcp:start`)
- [ ] Automatic fallback when services unavailable
- [ ] Clear error messages with recovery instructions
- [ ] Works with Claude Desktop integration

## Next Actions

**Immediate (This Session)**:

1. ✅ Complete memory statistics testing
2. ✅ Document current architecture state
3. Test enterprise documentation scenarios
4. Update TODO tracking with ecosystem pivot plan

**Next Session**:  

1. Research GenAI Toolbox PostgreSQL MCP server setup
2. Identify official Neo4j MCP server options
3. Create migration scripts for JSON → PostgreSQL
4. Implement fallback storage strategy

**Future Sessions**:

1. Full container orchestration setup
2. Performance testing with larger datasets  
3. Integration testing with other MCP ecosystem tools
4. Documentation and examples for community use

---

*Generated: 2025-06-08*  
*Status: In Progress*  
*Next Review: After Phase 1 completion*
