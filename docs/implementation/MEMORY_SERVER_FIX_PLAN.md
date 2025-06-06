# Memory Server Fix Plan

## Current Issues Analysis

### 1. Database Infrastructure Problems
- **Gremlin/Neptune Connectivity**: Config points to port 5105, but Gremlin runs on 8182
- **Port Conflicts**: Multiple database containers with conflicting port mappings
- **Health Check Failures**: Neptune health checks failing due to incorrect endpoints

### 2. MCP Protocol Implementation Issues
- **Missing Capabilities**: MCP Inspector reports "no MCP capabilities supported"
- **Initialize Response**: Missing proper `initialize` method with capability advertisement
- **SSE Transport**: Response format may not match MCP JSONRPC 2.0 specification

### 3. Integration Problems
- **Claude Code Access**: Memory server not accessible as MCP client from Claude Code
- **Dogfooding**: Cannot use memory tools directly in development
- **Health Endpoints**: Dashboard integration failing due to health check issues

## Fix Plan - 4 Phases

### Phase 1: Database Infrastructure
**Objective**: Fix local database connectivity and port conflicts

1. **Fix Gremlin Configuration**
   - Update `memory-config.service.ts` Neptune config from port 5105 → 8182
   - Verify Gremlin WebSocket endpoint: `ws://localhost:8182/gremlin`
   - Test connection and restart container if needed

2. **Consolidate Database Containers**
   - Stop duplicate containers (multiple DynamoDB, OpenSearch instances)
   - Standardize port mapping: 5100-5105 for local services
   - Update all service configs to match unified ports

3. **Database Health Verification**
   - OpenSearch: http://localhost:5102
   - DynamoDB: http://localhost:5100
   - Gremlin: ws://localhost:8182/gremlin

### Phase 2: MCP Protocol Implementation
**Objective**: Fix MCP capabilities and protocol compliance

4. **Implement MCP Capabilities Response**
   - Add proper `initialize` method handler
   - Implement `server/info` endpoint
   - Include capabilities: tools, resources, prompts

5. **Fix SSE Transport**
   - Ensure JSONRPC 2.0 message framing
   - Test with MCP Inspector connection
   - Verify event-stream format compliance

6. **Add Resources and Prompts** (if needed)
   - Memory usage documentation as resources
   - Example prompts for memory operations

### Phase 3: Claude Code Integration
**Objective**: Enable direct MCP tool usage from Claude Code

7. **Configure MCP Server Discovery**
   - Add memory server to Claude Code's available MCP servers
   - Test SSE transport from Claude Code
   - Verify tool calling works end-to-end

8. **Enable Dogfooding**
   - Use `store-memory` tool to document development progress
   - Test `retrieve-memories` for project context
   - Validate semantic search functionality

### Phase 4: Health and Testing
**Objective**: Ensure robust operation and dashboard integration

9. **Fix Health Checks**
   - Make all database connections pass health checks
   - Update `/memory/health` endpoint
   - Remove or handle gracefully failing services

10. **End-to-End Testing**
    - Store and retrieve memories via MCP
    - Test similarity search and graph connections
    - Verify dashboard can monitor memory server

## Success Criteria

- [ ] All database health checks pass
- [ ] MCP Inspector shows available tools and capabilities
- [ ] Claude Code can use memory server tools directly
- [ ] Memory storage and retrieval works via MCP protocol only
- [ ] Dashboard shows memory server as healthy with tool list
- [ ] Can dogfood memory system during development

## Timeline

- **Phase 1**: Database fixes (30 minutes)
- **Phase 2**: MCP protocol compliance (45 minutes)  
- **Phase 3**: Claude Code integration (30 minutes)
- **Phase 4**: Testing and validation (30 minutes)

**Total Estimated Time**: 2.25 hours

## Notes

This plan focuses on fixing the current memory server implementation first, before considering the broader architectural questions about MCP server composition and orchestration discussed separately.