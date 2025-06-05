# MCP Server Configuration

This document tracks the MCP servers configured for this project to ensure they can be restored after crashes.

## MCP Server Storage Location

**Primary Configuration File**: `~/.claude.json`
- MCP servers are stored under the `mcpServers` key
- This file persists across Claude Code sessions

## Currently Configured MCP Servers

### 1. AWS Labs Core MCP Server
```json
"awslabs.core-mcp-server": {
  "type": "stdio",
  "command": "uvx",
  "args": ["awslabs.core-mcp-server@latest", "FASTMCP_LOG_LEVEL=ERROR"],
  "env": {}
}
```

### 2. Filesystem Server
```json
"filesystem": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/acoose/projects"],
  "env": {}
}
```

### 3. Puppeteer Server
```json
"puppeteer": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
  "env": {}
}
```

### 4. Sequential Thinking Server
```json
"sequential-thinking": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
  "env": {}
}
```

## Backup Strategy

1. **Automatic Backup Script**: `scripts/backup-mcp-config.sh`
   - Creates timestamped backups of `~/.claude.json`
   - Stores backups in `.mcp-backups/` directory
   - Maintains a symlink to the latest backup

2. **Manual Backup**:
   ```bash
   # Run the backup script
   ./scripts/backup-mcp-config.sh
   ```

3. **Restore from Backup**:
   ```bash
   # Restore from latest backup
   cp .mcp-backups/claude-config-latest.json ~/.claude.json
   ```

## Adding New MCP Servers

To add new MCP servers, edit `~/.claude.json` and add entries under the `mcpServers` key following the pattern above.

## Project-Specific MCP Servers

You can also add project-specific MCP servers in `~/.claude.json` under:
```json
"projects": {
  "[project-path]": {
    "mcpServers": {
      // Project-specific servers here
    }
  }
}
```