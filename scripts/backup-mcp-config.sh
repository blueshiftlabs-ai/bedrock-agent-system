#!/bin/bash
# Backup MCP configuration to prevent loss during crashes

BACKUP_DIR="$HOME/projects/bedrock-agent-system/.mcp-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup main Claude configuration
if [ -f "$HOME/.claude.json" ]; then
    cp "$HOME/.claude.json" "$BACKUP_DIR/claude-config-$TIMESTAMP.json"
    echo "✅ Backed up ~/.claude.json to $BACKUP_DIR/claude-config-$TIMESTAMP.json"
    
    # Extract MCP servers from the config
    echo "📋 Extracting MCP server configurations..."
    jq '.projects | to_entries[] | select(.value.mcpServers != null and (.value.mcpServers | length > 0)) | {project: .key, servers: .value.mcpServers}' "$HOME/.claude.json" > "$BACKUP_DIR/mcp-servers-$TIMESTAMP.json"
    
    # Also create a combined MCP servers file
    jq -s 'reduce .[] as $item ({}; . * $item.servers)' "$BACKUP_DIR/mcp-servers-$TIMESTAMP.json" > "$BACKUP_DIR/mcp-servers-combined-$TIMESTAMP.json"
fi

# Create symlinks to the latest backups
ln -sf "$BACKUP_DIR/claude-config-$TIMESTAMP.json" "$BACKUP_DIR/claude-config-latest.json"
ln -sf "$BACKUP_DIR/mcp-servers-$TIMESTAMP.json" "$BACKUP_DIR/mcp-servers-latest.json"
ln -sf "$BACKUP_DIR/mcp-servers-combined-$TIMESTAMP.json" "$BACKUP_DIR/mcp-servers-combined-latest.json"

# Keep only the last 10 backups of each type
ls -t "$BACKUP_DIR"/claude-config-*.json | grep -v latest | tail -n +11 | xargs -r rm
ls -t "$BACKUP_DIR"/mcp-servers-*.json | grep -v latest | tail -n +11 | xargs -r rm

echo "📁 Backup complete. Latest backups:"
echo "   - Full config: $BACKUP_DIR/claude-config-latest.json"
echo "   - MCP servers: $BACKUP_DIR/mcp-servers-latest.json"
echo "   - Combined servers: $BACKUP_DIR/mcp-servers-combined-latest.json"
echo ""
echo "📝 MCP servers are stored per-project in ~/.claude.json"
echo "   Projects with MCP servers:"
jq -r '.projects | to_entries[] | select(.value.mcpServers != null and (.value.mcpServers | length > 0)) | "   - \(.key): \(.value.mcpServers | length) server(s)"' "$HOME/.claude.json" 2>/dev/null || echo "   (none found)"