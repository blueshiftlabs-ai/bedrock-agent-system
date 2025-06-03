#!/bin/bash

# =================================================================
# Hybrid MCP Server Startup Script
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
ENV_FILE="${PROJECT_ROOT}/.env"
ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"
MCP_CONFIG_DIR="${PROJECT_ROOT}/.mcp"
MCP_CONFIG_FILE="${MCP_CONFIG_DIR}/servers.json"

# Default configuration
MODE="${1:-server}"  # server, client, or hybrid
ENVIRONMENT="${2:-development}"  # development, staging, production

log_info "Starting Hybrid MCP Server..."
log_info "Mode: $MODE"
log_info "Environment: $ENVIRONMENT"
log_info "Project Root: $PROJECT_ROOT"

# Check if running in project directory
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    log_error "Not running from project root directory"
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
    log_warning "Environment file not found, creating from example..."
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        log_success "Created .env file from .env.example"
    else
        log_error ".env.example file not found"
        exit 1
    fi
fi

# Setup MCP configuration based on mode
setup_mcp_config() {
    log_info "Setting up MCP configuration for mode: $MODE"
    
    # Create MCP config directory
    mkdir -p "$MCP_CONFIG_DIR"
    
    case "$MODE" in
        "server")
            log_info "Configuring for MCP Server mode only"
            export MCP_SERVER_ENABLED=true
            export MCP_CLIENT_ENABLED=false
            ;;
        "client")
            log_info "Configuring for MCP Client mode only"
            export MCP_SERVER_ENABLED=false
            export MCP_CLIENT_ENABLED=true
            export MCP_CLIENT_AUTO_CONNECT=true
            
            # Create sample client configuration if it doesn't exist
            if [ ! -f "$MCP_CONFIG_FILE" ]; then
                log_info "Creating sample MCP client configuration..."
                cat > "$MCP_CONFIG_FILE" << EOF
{
  "version": "1.0.0",
  "servers": [
    {
      "id": "sequential-thinking",
      "name": "Sequential Thinking",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-sequential-thinking"],
      "enabled": false,
      "autoConnect": false
    },
    {
      "id": "filesystem",
      "name": "Filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "$(pwd)"],
      "enabled": false,
      "autoConnect": false
    }
  ],
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")"
}
EOF
                log_success "Created sample MCP client configuration"
                log_warning "Please edit $MCP_CONFIG_FILE to configure your MCP servers"
            fi
            ;;
        "hybrid")
            log_info "Configuring for Hybrid mode (both server and client)"
            export MCP_SERVER_ENABLED=true
            export MCP_CLIENT_ENABLED=true
            export MCP_CLIENT_AUTO_CONNECT=false
            log_warning "Hybrid mode enabled - monitor resource usage carefully"
            ;;
        *)
            log_error "Invalid mode: $MODE. Use 'server', 'client', or 'hybrid'"
            exit 1
            ;;
    esac
}

# Environment-specific configuration
setup_environment() {
    log_info "Configuring for environment: $ENVIRONMENT"
    
    case "$ENVIRONMENT" in
        "development")
            export NODE_ENV=development
            export LOG_LEVEL=debug
            export MCP_ENABLE_LOGGING=true
            export MCP_ENABLE_METRICS=true
            ;;
        "staging")
            export NODE_ENV=staging
            export LOG_LEVEL=info
            export MCP_ENABLE_LOGGING=true
            export MCP_ENABLE_METRICS=true
            ;;
        "production")
            export NODE_ENV=production
            export LOG_LEVEL=warn
            export MCP_ENABLE_LOGGING=true
            export MCP_ENABLE_METRICS=true
            # Additional production settings
            export MCP_SERVER_MAX_CONNECTIONS=500
            export MCP_TOOLS_ENABLE_CACHING=true
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT. Use 'development', 'staging', or 'production'"
            exit 1
            ;;
    esac
}

# Health check function
check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm/yarn/pnpm
    if command -v pnpm &> /dev/null; then
        PACKAGE_MANAGER="pnpm"
    elif command -v yarn &> /dev/null; then
        PACKAGE_MANAGER="yarn"
    elif command -v npm &> /dev/null; then
        PACKAGE_MANAGER="npm"
    else
        log_error "No package manager found (npm, yarn, or pnpm)"
        exit 1
    fi
    
    log_success "Using package manager: $PACKAGE_MANAGER"
    
    # Check if node_modules exists
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        log_warning "node_modules not found, installing dependencies..."
        cd "$PROJECT_ROOT"
        $PACKAGE_MANAGER install
        log_success "Dependencies installed"
    fi
}

# Pre-flight checks
preflight_checks() {
    log_info "Running pre-flight checks..."
    
    # Check port availability
    PORT=${PORT:-3000}
    if command -v lsof &> /dev/null; then
        if lsof -i ":$PORT" &> /dev/null; then
            log_warning "Port $PORT is already in use"
            read -p "Do you want to continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Startup cancelled"
                exit 0
            fi
        fi
    fi
    
    # Check disk space (warn if less than 1GB)
    if command -v df &> /dev/null; then
        AVAILABLE_SPACE=$(df "$PROJECT_ROOT" | awk 'NR==2 {print $4}')
        if [ "$AVAILABLE_SPACE" -lt 1048576 ]; then  # 1GB in KB
            log_warning "Low disk space: less than 1GB available"
        fi
    fi
    
    log_success "Pre-flight checks completed"
}

# Main execution
main() {
    log_info "=== Hybrid MCP Server Startup ==="
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    # Run checks and setup
    check_dependencies
    setup_mcp_config
    setup_environment
    preflight_checks
    
    # Display configuration summary
    log_info "=== Configuration Summary ==="
    log_info "Mode: $MODE"
    log_info "Environment: $ENVIRONMENT"
    log_info "MCP Server: ${MCP_SERVER_ENABLED:-false}"
    log_info "MCP Client: ${MCP_CLIENT_ENABLED:-false}"
    log_info "Port: ${PORT:-3000}"
    log_info "Log Level: ${LOG_LEVEL:-info}"
    
    # Start the server
    log_info "Starting server..."
    log_info "Press Ctrl+C to stop"
    echo
    
    # Use the appropriate package manager
    case "$PACKAGE_MANAGER" in
        "pnpm")
            exec pnpm start:dev
            ;;
        "yarn")
            exec yarn start:dev
            ;;
        "npm")
            exec npm run start:dev
            ;;
    esac
}

# Handle signals for graceful shutdown
trap 'log_info "Shutting down..."; exit 0' SIGINT SIGTERM

# Execute main function
main "$@"