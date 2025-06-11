#!/bin/bash

# Backup Claude Code configuration files
# Run this script regularly to prevent losing MCP server configurations

BACKUP_DIR="$HOME/projects/bedrock-agent-system/.mcp-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup Claude configuration
if [ -f "$HOME/.claude.json" ]; then
    cp "$HOME/.claude.json" "$BACKUP_DIR/claude-config-$TIMESTAMP.json"
    echo "✅ Backed up .claude.json to $BACKUP_DIR/claude-config-$TIMESTAMP.json"
else
    echo "❌ No .claude.json file found"
fi

# Backup any other Claude config files
if [ -d "$HOME/.claude" ]; then
    tar -czf "$BACKUP_DIR/claude-folder-$TIMESTAMP.tar.gz" -C "$HOME" .claude
    echo "✅ Backed up .claude folder to $BACKUP_DIR/claude-folder-$TIMESTAMP.tar.gz"
fi

# Remove backups older than 30 days
find "$BACKUP_DIR" -name "claude-config-*.json" -mtime +30 -delete
find "$BACKUP_DIR" -name "claude-folder-*.tar.gz" -mtime +30 -delete

echo "✅ Backup complete. Old backups (30+ days) cleaned up."
echo "💡 To restore: cp $BACKUP_DIR/claude-config-$TIMESTAMP.json $HOME/.claude.json"