# MCP Memory Server Functional Testing Guide

This guide outlines functional tests for the MCP Memory Server and Dashboard.

## Memory Operations Testing

### 1. Store Memory Test

```
Test: Store a new memory
Steps:
1. Use store-memory MCP tool with:
   - content: "Test memory for functional testing"
   - type: "episodic"
   - project: "test-project"
   - tags: ["test", "functional"]
2. Verify response contains:
   - memory_id
   - opensearch_id
   - neo4j_node_id
   - success: true
3. Check dashboard shows updated memory count
```

### 2. Retrieve Memory Test

```
Test: Search and retrieve memories
Steps:
1. Use retrieve-memories tool with:
   - query: "test"
   - project: "test-project"
   - limit: 10
2. Verify response contains:
   - Array of memories
   - Each memory has id, content, type, created_at
3. Verify search relevance scoring
```

### 3. Memory Connections Test

```
Test: Create and retrieve connections
Steps:
1. Store two test memories
2. Use add-connection tool with:
   - from_memory_id: first memory ID
   - to_memory_id: second memory ID
   - relationship_type: "RELATES_TO"
   - bidirectional: true
3. Use retrieve-connections tool
4. Verify connection appears in graph visualization
```

### 4. Memory Consolidation Test

```
Test: Consolidate duplicate memories
Steps:
1. Store 3 similar memories with slight variations
2. Use consolidate-memories tool
3. Verify duplicates are merged
4. Check that relationships are preserved
```

## Dashboard Functional Testing

### 1. Real-time Updates Test

```
Test: Dashboard updates in real-time
Steps:
1. Open dashboard in browser
2. Store new memory via MCP tool
3. Verify dashboard updates without refresh:
   - Total memory count increases
   - Recent activity shows new memory
   - Memory appears in browser
```

### 2. Memory Browser CRUD Test

```
Test: Create, Read, Update, Delete operations
Steps:
1. Navigate to /memories
2. Add new memory via UI
3. Search for the memory
4. Select and view details
5. Delete the memory
6. Verify it's removed from list
```

### 3. Log Streaming Test

```
Test: Real-time log streaming
Steps:
1. Navigate to /logs
2. Select MCP Memory Server source
3. Perform memory operations
4. Verify logs appear in real-time
5. Test filtering by level and source
6. Download logs and verify format
```

### 4. Multi-Project Isolation Test

```
Test: Project-based memory isolation
Steps:
1. Store memories in project A
2. Store memories in project B
3. Search with project filter for A
4. Verify only project A memories appear
5. Switch to project B filter
6. Verify isolation is maintained
```

## Performance Testing

### 1. Bulk Memory Test

```
Test: Handle large numbers of memories
Steps:
1. Store 100 memories in rapid succession
2. Measure response times
3. Verify all memories are stored
4. Test retrieval performance
5. Check dashboard responsiveness
```

### 2. Concurrent Operations Test

```
Test: Handle concurrent requests
Steps:
1. Launch 10 parallel store-memory operations
2. Launch 10 parallel retrieve-memory operations
3. Verify no data corruption
4. Check error handling
5. Monitor system resources
```

## Error Handling Testing

### 1. Invalid Input Test

```
Test: Handle invalid inputs gracefully
Steps:
1. Try store-memory with empty content
2. Try retrieve-memories with invalid project
3. Try add-connection with non-existent IDs
4. Verify appropriate error messages
5. Ensure system remains stable
```

### 2. Service Failure Test

```
Test: Handle backend service failures
Steps:
1. Stop OpenSearch container
2. Try memory operations
3. Verify graceful degradation
4. Check error messages in dashboard
5. Restart service and verify recovery
```

## Integration Testing

### 1. Full Workflow Test

```
Test: Complete memory lifecycle
Steps:
1. Store episodic memory about learning a concept
2. Store semantic memory about the concept
3. Create connection between them
4. Store procedural memory about applying concept
5. Create observation linking all three
6. Retrieve memories by concept query
7. Verify graph shows relationships
8. Consolidate if duplicates exist
9. Export memories for backup
```

### 2. Cross-Component Test

```
Test: All components work together
Steps:
1. Store memory (DynamoDB + OpenSearch + Neo4j)
2. View in dashboard (API + Frontend)
3. Check logs show operations (Logging)
4. View in graph visualization (Neo4j)
5. Search via semantic query (OpenSearch)
6. Check admin interfaces show data
```

## Acceptance Criteria

- [ ] All CRUD operations work correctly
- [ ] Real-time updates function properly
- [ ] Search returns relevant results
- [ ] Graph visualization displays connections
- [ ] Logs stream in real-time
- [ ] Error handling prevents data loss
- [ ] Performance meets requirements
- [ ] Multi-project isolation works
- [ ] Dashboard is responsive
- [ ] All navigation works correctly