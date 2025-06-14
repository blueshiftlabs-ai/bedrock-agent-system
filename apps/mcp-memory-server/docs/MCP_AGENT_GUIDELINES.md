# MCP Memory Server Agent Guidelines

## Agent Self-Identification

When using the MCP Memory Server tools, **all agents MUST provide their agent_id** when storing memories. This is critical for:

1. **Attribution**: Tracking which agent created each memory
2. **Context**: Understanding the source and perspective of stored information
3. **Filtering**: Enabling agent-specific memory retrieval
4. **Analytics**: Monitoring agent activity and memory patterns

## Required Agent Behavior

### When Storing Memories

Always include your agent identifier:

```json
{
  "method": "tools/call",
  "params": {
    "name": "store-memory",
    "arguments": {
      "content": "Your memory content here",
      "agent_id": "claude-code",  // REQUIRED: Your agent identifier
      "type": "episodic",
      "project": "project-name",
      "tags": ["relevant", "tags"]
    }
  }
}
```

### Common Agent IDs

- `claude-code`: For Claude Code (Anthropic's official CLI)
- `claude-desktop`: For Claude Desktop application
- `github-copilot`: For GitHub Copilot
- `cursor`: For Cursor AI editor
- `custom-agent-name`: For custom implementations

### Best Practices

1. **Consistent Naming**: Use the same agent_id across all memory operations
2. **No Anonymous Memories**: Never omit the agent_id field
3. **Descriptive IDs**: Use clear, recognizable agent identifiers
4. **Version Tracking**: Consider including version in agent_id if relevant (e.g., `claude-code-v1.2`)

## Memory Types and When to Use Them

- **episodic**: Conversations, events, interactions
- **semantic**: Facts, concepts, learned information
- **procedural**: How-to knowledge, processes, workflows
- **working**: Temporary session-specific information

## Example: Complete Memory Storage

```javascript
// Good - Includes all required fields
const memory = {
  content: "Successfully implemented dashboard filtering with React Query",
  agent_id: "claude-code",
  type: "episodic",
  project: "bedrock-agent-system",
  tags: ["implementation", "dashboard", "react-query", "success"],
  session_id: "session-123" // Optional but recommended for episodic
}

// Bad - Missing agent_id
const badMemory = {
  content: "Some content",
  type: "episodic"
  // Missing agent_id - This will show as 'anonymous' or 'unknown'
}
```

## Integration with Claude Code

When Claude Code uses the memory server, it should automatically:

1. Set `agent_id: "claude-code"` for all memory operations
2. Include session context when available
3. Tag memories appropriately for later retrieval
4. Use the correct memory type based on content

## Monitoring and Compliance

The MCP Memory Server dashboard will:
- Show warnings for memories without agent_id
- Display agent activity statistics
- Enable filtering by agent
- Track agent-specific memory patterns

Remember: **Every memory should know its creator!**