#!/bin/bash
# Restore MCP configuration from backup

BACKUP_DIR="$HOME/projects/bedrock-agent-system/.mcp-backups"
CLAUDE_CONFIG="$HOME/.claude.json"

# Function to show usage
usage() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -l, --list        List available backups"
    echo "  -r, --restore     Restore from latest backup"
    echo "  -f, --file FILE   Restore from specific backup file"
    echo "  -s, --show        Show current MCP servers"
    echo "  -h, --help        Show this help"
    exit 1
}

# Function to list backups
list_backups() {
    echo "Available backups:"
    echo ""
    echo "Full configuration backups:"
    ls -lt "$BACKUP_DIR"/claude-config-*.json 2>/dev/null | grep -v latest | head -10 | awk '{print "  " $9}'
    echo ""
    echo "MCP server backups:"
    ls -lt "$BACKUP_DIR"/mcp-servers-combined-*.json 2>/dev/null | grep -v latest | head -10 | awk '{print "  " $9}'
}

# Function to show current MCP servers
show_current_servers() {
    echo "Current MCP servers in ~/.claude.json:"
    echo ""
    if [ -f "$CLAUDE_CONFIG" ]; then
        jq -r '.projects | to_entries[] | select(.value.mcpServers != null and (.value.mcpServers | length > 0)) | 
            "\n📁 Project: \(.key)\n" + 
            "   Servers:\n" + 
            (.value.mcpServers | to_entries[] | "   - \(.key): \(.value.type) \(.value.command // .value.url)")' "$CLAUDE_CONFIG" 2>/dev/null || echo "No MCP servers found"
    else
        echo "No ~/.claude.json file found"
    fi
}

# Function to restore MCP servers
restore_servers() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        echo "❌ Backup file not found: $backup_file"
        exit 1
    fi
    
    if [ ! -f "$CLAUDE_CONFIG" ]; then
        echo "❌ No ~/.claude.json file found. Cannot restore MCP servers."
        exit 1
    fi
    
    # Create a backup of current config
    echo "📋 Creating backup of current configuration..."
    cp "$CLAUDE_CONFIG" "$CLAUDE_CONFIG.bak.$(date +%Y%m%d_%H%M%S)"
    
    # Extract current project path from Claude's process or use default
    CURRENT_PROJECT=$(pwd)
    
    echo "🔄 Restoring MCP servers to project: $CURRENT_PROJECT"
    
    # If it's a combined servers file, restore directly to current project
    if [[ "$backup_file" == *"mcp-servers-combined"* ]]; then
        # Read the servers from backup
        SERVERS=$(jq -c '.' "$backup_file")
        
        # Update the current project's mcpServers
        jq --arg project "$CURRENT_PROJECT" --argjson servers "$SERVERS" \
            '.projects[$project].mcpServers = $servers' "$CLAUDE_CONFIG" > "$CLAUDE_CONFIG.tmp" && \
            mv "$CLAUDE_CONFIG.tmp" "$CLAUDE_CONFIG"
        
        echo "✅ Restored MCP servers to project: $CURRENT_PROJECT"
    else
        # For full config restore, be more careful
        echo "⚠️  Full config restore - this will overwrite your entire ~/.claude.json"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cp "$backup_file" "$CLAUDE_CONFIG"
            echo "✅ Restored full configuration from: $backup_file"
        else
            echo "❌ Restore cancelled"
            exit 1
        fi
    fi
    
    # Show what was restored
    echo ""
    show_current_servers
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    usage
fi

case "$1" in
    -l|--list)
        list_backups
        ;;
    -r|--restore)
        if [ -f "$BACKUP_DIR/mcp-servers-combined-latest.json" ]; then
            restore_servers "$BACKUP_DIR/mcp-servers-combined-latest.json"
        else
            echo "❌ No latest backup found"
            exit 1
        fi
        ;;
    -f|--file)
        if [ -z "$2" ]; then
            echo "❌ Please specify a backup file"
            exit 1
        fi
        restore_servers "$2"
        ;;
    -s|--show)
        show_current_servers
        ;;
    -h|--help)
        usage
        ;;
    *)
        echo "Unknown option: $1"
        usage
        ;;
esac