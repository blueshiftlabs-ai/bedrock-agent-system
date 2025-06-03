#!/bin/bash

# =================================================================
# MCP Configuration Management Script
# =================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MCP_CONFIG_DIR="${PROJECT_ROOT}/.mcp"
MCP_CONFIG_FILE="${MCP_CONFIG_DIR}/servers.json"

# Commands
COMMAND="${1:-help}"

# Help function
show_help() {
    cat << EOF
MCP Configuration Management Script

Usage: $0 <command> [options]

Commands:
    help                    Show this help message
    init                    Initialize MCP configuration
    list                    List configured MCP servers
    add <type> [name]       Add a new MCP server configuration
    remove <id>             Remove an MCP server configuration
    enable <id>             Enable an MCP server
    disable <id>            Disable an MCP server
    test <id>               Test connection to an MCP server
    export [file]           Export configuration to file
    import <file>           Import configuration from file
    validate                Validate current configuration
    status                  Show MCP service status

Server Types:
    sequential-thinking     Sequential thinking MCP server
    filesystem             Filesystem MCP server
    brave-search           Brave search MCP server (requires API key)
    custom                 Custom MCP server

Examples:
    $0 init
    $0 add filesystem "Local Files"
    $0 add sequential-thinking
    $0 enable filesystem
    $0 test filesystem
    $0 list

EOF
}

# Initialize MCP configuration
init_config() {
    log_info "Initializing MCP configuration..."
    
    mkdir -p "$MCP_CONFIG_DIR"
    
    if [ -f "$MCP_CONFIG_FILE" ]; then
        log_warning "Configuration file already exists"
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Initialization cancelled"
            return 0
        fi
    fi
    
    cat > "$MCP_CONFIG_FILE" << EOF
{
  "version": "1.0.0",
  "servers": [],
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")"
}
EOF
    
    log_success "MCP configuration initialized"
}

# List configured servers
list_servers() {
    if [ ! -f "$MCP_CONFIG_FILE" ]; then
        log_error "Configuration file not found. Run '$0 init' first."
        exit 1
    fi
    
    log_info "Configured MCP Servers:"
    echo
    
    # Use jq if available, otherwise fallback to basic parsing
    if command -v jq &> /dev/null; then
        jq -r '.servers[] | "ID: \(.id // "unknown")\nName: \(.name // "unnamed")\nTransport: \(.transport // "unknown")\nEnabled: \(.enabled // false)\nAuto-connect: \(.autoConnect // false)\n---"' "$MCP_CONFIG_FILE"
    else
        log_warning "jq not available, showing raw configuration"
        cat "$MCP_CONFIG_FILE"
    fi
}

# Add a new server configuration
add_server() {
    local server_type="$1"
    local server_name="$2"
    
    if [ -z "$server_type" ]; then
        log_error "Server type is required"
        log_info "Available types: sequential-thinking, filesystem, brave-search, custom"
        exit 1
    fi
    
    if [ ! -f "$MCP_CONFIG_FILE" ]; then
        log_info "Configuration file not found, initializing..."
        init_config
    fi
    
    # Generate unique ID
    local server_id="${server_type}-$(date +%s)"
    
    case "$server_type" in
        "sequential-thinking")
            local config=$(cat << EOF
{
  "id": "$server_id",
  "name": "${server_name:-Sequential Thinking}",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@anthropic-ai/mcp-server-sequential-thinking"],
  "enabled": false,
  "autoConnect": false
}
EOF
)
            ;;
        "filesystem")
            local config=$(cat << EOF
{
  "id": "$server_id",
  "name": "${server_name:-Filesystem}",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "$PROJECT_ROOT"],
  "enabled": false,
  "autoConnect": false
}
EOF
)
            ;;
        "brave-search")
            read -p "Enter Brave API key: " -s brave_api_key
            echo
            local config=$(cat << EOF
{
  "id": "$server_id",
  "name": "${server_name:-Brave Search}",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@anthropic-ai/mcp-server-brave-search"],
  "env": {
    "BRAVE_API_KEY": "$brave_api_key"
  },
  "enabled": false,
  "autoConnect": false
}
EOF
)
            ;;
        "custom")
            echo "Configuring custom MCP server..."
            read -p "Command: " custom_command
            read -p "Arguments (space-separated): " custom_args_input
            
            # Convert space-separated args to JSON array
            local args_array=""
            if [ -n "$custom_args_input" ]; then
                IFS=' ' read -ra args <<< "$custom_args_input"
                args_array=$(printf ',"%s"' "${args[@]}")
                args_array="[${args_array:1}]"
            else
                args_array="[]"
            fi
            
            local config=$(cat << EOF
{
  "id": "$server_id",
  "name": "${server_name:-Custom MCP Server}",
  "transport": "stdio",
  "command": "$custom_command",
  "args": $args_array,
  "enabled": false,
  "autoConnect": false
}
EOF
)
            ;;
        *)
            log_error "Unknown server type: $server_type"
            exit 1
            ;;
    esac
    
    # Add to configuration file
    if command -v jq &> /dev/null; then
        local temp_file=$(mktemp)
        jq --argjson server "$config" '.servers += [$server] | .lastUpdated = now | strftime("%Y-%m-%dT%H:%M:%S.%3NZ")' "$MCP_CONFIG_FILE" > "$temp_file"
        mv "$temp_file" "$MCP_CONFIG_FILE"
        log_success "Added server: $server_id"
    else
        log_error "jq is required to add servers. Please install jq and try again."
        exit 1
    fi
}

# Remove a server configuration
remove_server() {
    local server_id="$1"
    
    if [ -z "$server_id" ]; then
        log_error "Server ID is required"
        exit 1
    fi
    
    if [ ! -f "$MCP_CONFIG_FILE" ]; then
        log_error "Configuration file not found"
        exit 1
    fi
    
    if command -v jq &> /dev/null; then
        local temp_file=$(mktemp)
        jq --arg id "$server_id" '.servers = (.servers | map(select(.id != $id))) | .lastUpdated = now | strftime("%Y-%m-%dT%H:%M:%S.%3NZ")' "$MCP_CONFIG_FILE" > "$temp_file"
        mv "$temp_file" "$MCP_CONFIG_FILE"
        log_success "Removed server: $server_id"
    else
        log_error "jq is required to remove servers. Please install jq and try again."
        exit 1
    fi
}

# Enable/disable a server
toggle_server() {
    local server_id="$1"
    local enabled="$2"
    
    if [ -z "$server_id" ]; then
        log_error "Server ID is required"
        exit 1
    fi
    
    if [ ! -f "$MCP_CONFIG_FILE" ]; then
        log_error "Configuration file not found"
        exit 1
    fi
    
    if command -v jq &> /dev/null; then
        local temp_file=$(mktemp)
        jq --arg id "$server_id" --argjson enabled "$enabled" '.servers = (.servers | map(if .id == $id then .enabled = $enabled else . end)) | .lastUpdated = now | strftime("%Y-%m-%dT%H:%M:%S.%3NZ")' "$MCP_CONFIG_FILE" > "$temp_file"
        mv "$temp_file" "$MCP_CONFIG_FILE"
        local action=$([ "$enabled" = "true" ] && echo "Enabled" || echo "Disabled")
        log_success "$action server: $server_id"
    else
        log_error "jq is required to modify servers. Please install jq and try again."
        exit 1
    fi
}

# Test server connection
test_server() {
    local server_id="$1"
    
    if [ -z "$server_id" ]; then
        log_error "Server ID is required"
        exit 1
    fi
    
    log_info "Testing connection to server: $server_id"
    log_warning "This feature requires the MCP server to be running"
    log_info "Use the health check endpoint: curl http://localhost:3000/api/v1/health/mcp/test/$server_id"
}

# Validate configuration
validate_config() {
    if [ ! -f "$MCP_CONFIG_FILE" ]; then
        log_error "Configuration file not found"
        exit 1
    fi
    
    log_info "Validating MCP configuration..."
    
    if command -v jq &> /dev/null; then
        if jq empty "$MCP_CONFIG_FILE" 2>/dev/null; then
            log_success "Configuration file is valid JSON"
            
            # Check required fields
            local servers_count=$(jq '.servers | length' "$MCP_CONFIG_FILE")
            log_info "Found $servers_count configured server(s)"
            
            # Validate each server
            jq -r '.servers[] | select(.enabled == true) | .id' "$MCP_CONFIG_FILE" | while read -r server_id; do
                log_info "Enabled server: $server_id"
            done
            
        else
            log_error "Configuration file contains invalid JSON"
            exit 1
        fi
    else
        log_warning "jq not available, skipping detailed validation"
        if [ -s "$MCP_CONFIG_FILE" ]; then
            log_success "Configuration file exists and is not empty"
        else
            log_error "Configuration file is empty"
            exit 1
        fi
    fi
}

# Show service status
show_status() {
    log_info "MCP Service Status"
    
    # Check if server is running
    local port=${PORT:-3000}
    if command -v curl &> /dev/null; then
        if curl -s "http://localhost:$port/api/v1/health" > /dev/null 2>&1; then
            log_success "MCP Server is running on port $port"
            
            # Get detailed status
            log_info "Getting detailed status..."
            curl -s "http://localhost:$port/api/v1/health/mcp" | jq . 2>/dev/null || echo "Could not parse status response"
        else
            log_warning "MCP Server is not responding on port $port"
        fi
    else
        log_warning "curl not available, cannot check server status"
    fi
}

# Export configuration
export_config() {
    local output_file="$1"
    
    if [ ! -f "$MCP_CONFIG_FILE" ]; then
        log_error "Configuration file not found"
        exit 1
    fi
    
    if [ -z "$output_file" ]; then
        output_file="mcp-config-$(date +%Y%m%d_%H%M%S).json"
    fi
    
    cp "$MCP_CONFIG_FILE" "$output_file"
    log_success "Configuration exported to: $output_file"
}

# Import configuration
import_config() {
    local input_file="$1"
    
    if [ -z "$input_file" ]; then
        log_error "Input file is required"
        exit 1
    fi
    
    if [ ! -f "$input_file" ]; then
        log_error "Input file not found: $input_file"
        exit 1
    fi
    
    # Validate input file
    if command -v jq &> /dev/null; then
        if ! jq empty "$input_file" 2>/dev/null; then
            log_error "Input file contains invalid JSON"
            exit 1
        fi
    fi
    
    # Backup existing configuration
    if [ -f "$MCP_CONFIG_FILE" ]; then
        local backup_file="$MCP_CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$MCP_CONFIG_FILE" "$backup_file"
        log_info "Existing configuration backed up to: $backup_file"
    fi
    
    mkdir -p "$MCP_CONFIG_DIR"
    cp "$input_file" "$MCP_CONFIG_FILE"
    log_success "Configuration imported from: $input_file"
}

# Main execution
case "$COMMAND" in
    "help"|"-h"|"--help")
        show_help
        ;;
    "init")
        init_config
        ;;
    "list")
        list_servers
        ;;
    "add")
        add_server "$2" "$3"
        ;;
    "remove")
        remove_server "$2"
        ;;
    "enable")
        toggle_server "$2" "true"
        ;;
    "disable")
        toggle_server "$2" "false"
        ;;
    "test")
        test_server "$2"
        ;;
    "validate")
        validate_config
        ;;
    "status")
        show_status
        ;;
    "export")
        export_config "$2"
        ;;
    "import")
        import_config "$2"
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        echo
        show_help
        exit 1
        ;;
esac