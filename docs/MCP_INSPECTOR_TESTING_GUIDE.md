# MCP Inspector Testing Guide for Memory Server

This guide provides comprehensive instructions for testing the MCP Memory Server using the MCP Inspector tool.

## Prerequisites

1. **Memory Server Running**: Ensure the memory server is running on port 4100
   ```bash
   cd apps/mcp-memory-server
   pnpm local:dev  # This starts dependencies and the server
   ```

2. **MCP Inspector**: Install if not already available
   ```bash
   npx @modelcontextprotocol/inspector
   ```

## Connecting to Memory Server

1. Open MCP Inspector in your browser (usually http://localhost:5173)
2. Enter the memory server URL: `http://localhost:4100/memory/mcp`
3. Select transport type: `SSE` (Server-Sent Events)
4. Click "Connect"

## Available Tools

The memory server provides 9 MCP tools:

### 1. `store-memory`
Store memories with semantic understanding and context.

**Parameters:**
- `content` (required): Memory content to store
- `agent_id` (optional): ID of the agent storing the memory
- `session_id` (optional): Session ID for episodic memories
- `project` (optional): Project context (defaults to "common")
- `type` (optional): Memory type - `episodic`, `semantic`, `procedural`, `working`
- `content_type` (optional): Content type - `text`, `code`
- `tags` (optional): Array of tags for categorization

**Example Test:**
```json
{
  "content": "The MCP Memory Server uses Neo4j for knowledge graph storage",
  "agent_id": "test-agent-1",
  "project": "bedrock-agent-system",
  "type": "semantic",
  "tags": ["mcp", "neo4j", "architecture"]
}
```

### 2. `retrieve-memories`
Retrieve relevant memories using semantic search.

**Parameters:**
- `query` (optional): Search query for memory retrieval
- `memory_ids` (optional): Specific memory IDs to retrieve
- `agent_id` (optional): Filter by agent ID
- `session_id` (optional): Filter by session ID
- `project` (optional): Filter by project context
- `type` (optional): Filter by memory type
- `content_type` (optional): Filter by content type
- `limit` (optional, default: 10): Maximum memories to return
- `threshold` (optional, 0-1): Similarity threshold
- `include_related` (optional, default: false): Include graph-connected memories

**Example Tests:**

Test 1 - Search by query and project:
```json
{
  "query": "Neo4j knowledge graph",
  "project": "bedrock-agent-system",
  "limit": 5
}
```

Test 2 - Retrieve specific memories:
```json
{
  "memory_ids": ["mem_1749290386151_65fbc25f", "mem_1749290440747_d0e2c23f"]
}
```

### 3. `add-connection`
Create relationships between memories in the knowledge graph.

**Parameters:**
- `from_memory_id` (required): Source memory ID
- `to_memory_id` (required): Target memory ID
- `relationship_type` (required): Type of relationship (e.g., RELATES_TO, SIMILAR_TO)
- `bidirectional` (optional, default: false): Create bidirectional relationship
- `properties` (optional): Additional properties for the relationship

**Example Test:**
```json
{
  "from_memory_id": "mem_1749290386151_65fbc25f",
  "to_memory_id": "mem_1749290440747_d0e2c23f",
  "relationship_type": "RELATES_TO",
  "bidirectional": true,
  "properties": {
    "confidence": 0.95,
    "reason": "Both discuss memory architecture"
  }
}
```

### 4. `create-observation`
Create an observation and link it to related memories.

**Parameters:**
- `agent_id` (required): ID of the agent making the observation
- `observation` (required): The observation content
- `context` (optional): Additional context
- `related_memory_ids` (optional): Memory IDs related to this observation

**Example Test:**
```json
{
  "agent_id": "test-agent-1",
  "observation": "The Neo4j integration provides superior graph traversal capabilities",
  "context": {
    "source": "testing",
    "confidence": 0.9
  },
  "related_memory_ids": ["mem_1749290386151_65fbc25f"]
}
```

### 5. `consolidate-memories`
Consolidate and merge related memories to reduce redundancy.

**Parameters:**
- `agent_id` (optional): Agent ID to consolidate memories for
- `similarity_threshold` (optional, default: 0.9): Similarity threshold (0-1)
- `max_consolidations` (optional, default: 50): Maximum consolidations to perform

**Example Test:**
```json
{
  "agent_id": "test-agent-1",
  "similarity_threshold": 0.85,
  "max_consolidations": 10
}
```

### 6. `delete-memory`
Delete a memory and all its relationships.

**Parameters:**
- `memory_id` (required): ID of the memory to delete

**Example Test:**
```json
{
  "memory_id": "mem_1749290440747_d0e2c23f"
}
```

### 7. `get-memory-statistics`
Get memory statistics and analytics.

**Parameters:**
- `agent_id` (optional): Filter statistics by agent ID
- `project` (optional): Filter statistics by project

**Example Tests:**

Test 1 - Overall statistics:
```json
{}
```

Test 2 - Project-specific statistics:
```json
{
  "project": "bedrock-agent-system"
}
```

### 8. `list-agents`
List all agents that have stored memories.

**Parameters:**
- `project` (optional): Filter agents by project context

**Example Tests:**

Test 1 - List all agents:
```json
{}
```

Test 2 - List agents for specific project:
```json
{
  "project": "bedrock-agent-system"
}
```

### 9. `list-projects`
List all projects that contain memories.

**Parameters:**
- `include_stats` (optional, default: true): Include memory and agent statistics

**Example Test:**
```json
{
  "include_stats": true
}
```

## Testing Workflow

### 1. Basic Functionality Test

1. **Store a memory** with project context
2. **List projects** to verify it was created
3. **List agents** to verify agent tracking
4. **Retrieve the memory** by ID
5. **Get statistics** to verify counts

### 2. Project Isolation Test

1. **Store memory in project A** with agent-1
2. **Store memory in project B** with agent-1
3. **Store memory in "common" project** with agent-2
4. **List projects** - should see all three
5. **List agents by project** - agent-1 should appear in A and B
6. **Retrieve memories by project** - should only get relevant memories

### 3. Knowledge Graph Test

1. **Store two related memories**
2. **Add connection** between them
3. **Retrieve with include_related=true**
4. **Create observation** linking to memories
5. **Verify graph relationships** in response

### 4. Search and Filter Test

1. **Store memories with different types** (episodic, semantic, procedural)
2. **Store memories with different tags**
3. **Search by query** with various filters
4. **Test threshold values** (0.5, 0.7, 0.9)
5. **Test limit parameter** with different values

### 5. Cleanup Test

1. **Get initial statistics**
2. **Delete specific memories**
3. **Get updated statistics** to verify deletion
4. **Consolidate memories** to reduce duplicates

## Expected Responses

### Successful Memory Storage
```json
{
  "memory_id": "mem_1749290386151_65fbc25f",
  "opensearch_id": "d1b6a2aa-996b-4c75-8c85-839388d50479",
  "neo4j_node_id": "mem_1749290386151_65fbc25f",
  "success": true
}
```

### Successful Retrieval
```json
{
  "memories": [
    {
      "memory": {
        "metadata": {
          "memory_id": "mem_1749290386151_65fbc25f",
          "type": "semantic",
          "content_type": "text",
          "project": "bedrock-agent-system",
          // ... more metadata
        },
        "content": "The MCP Memory Server uses Neo4j...",
        "embeddings": [0.081, -0.055, ...]
      },
      "similarity_score": 0.95,
      "related_memories": [],
      "graph_connections": []
    }
  ],
  "total_count": 1,
  "search_time_ms": 45
}
```

### Project List Response
```json
{
  "projects": [
    {
      "project_id": "bedrock-agent-system",
      "name": "bedrock-agent-system",
      "description": "Project: bedrock-agent-system",
      "memory_count": 15,
      "agent_count": 3,
      "created_at": "2025-01-07T10:00:00.000Z",
      "last_activity": "2025-01-07T15:30:00.000Z"
    },
    {
      "project_id": "common",
      "name": "Common/Shared",
      "description": "Shared memories across all projects",
      "memory_count": 8,
      "agent_count": 5,
      "created_at": "2025-01-06T09:00:00.000Z",
      "last_activity": "2025-01-07T14:00:00.000Z"
    }
  ],
  "total_count": 2
}
```

## Troubleshooting

### Connection Issues
- Verify server is running: `curl http://localhost:4100/health`
- Check memory health: `curl http://localhost:4100/memory/health`
- Ensure SSE transport is selected in Inspector

### Empty Results
- In local mode, some features are limited
- Ensure OpenSearch and Neo4j are running for full functionality
- Check server logs for detailed error messages

### Field Data Errors
- OpenSearch aggregation errors indicate mapping issues
- May need to recreate indices after schema changes

### Project Field Missing
- Ensure you're using the latest build
- Check that project parameter is included in requests
- Verify in returned metadata

## Advanced Testing

### Performance Testing
1. Store 100+ memories rapidly
2. Test retrieval with large result sets
3. Monitor response times in statistics

### Concurrency Testing
1. Open multiple Inspector sessions
2. Store memories simultaneously
3. Verify data consistency

### Error Handling
1. Test with invalid memory IDs
2. Test with missing required parameters
3. Test with invalid relationship types
4. Verify appropriate error messages

## Notes

- Default project is "common" if not specified
- Memory IDs follow format: `mem_<timestamp>_<uuid>`
- All timestamps are in ISO 8601 format
- Embeddings are 384-dimensional vectors in local mode
- Neo4j relationships are created automatically for tags