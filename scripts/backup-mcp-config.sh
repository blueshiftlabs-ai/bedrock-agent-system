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
fi

# Create a symlink to the latest backup
ln -sf "$BACKUP_DIR/claude-config-$TIMESTAMP.json" "$BACKUP_DIR/claude-config-latest.json"

# Keep only the last 10 backups
ls -t "$BACKUP_DIR"/claude-config-*.json | grep -v latest | tail -n +11 | xargs -r rm

echo "📁 Backup complete. Latest backup: $BACKUP_DIR/claude-config-latest.json"
echo "📝 MCP servers are stored in ~/.claude.json under the 'mcpServers' key"