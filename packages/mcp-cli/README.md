# MCP CLI

A comprehensive command-line interface for managing the MCP (Model Context Protocol) Hybrid Server and all its components.

## Features

- **Server Management**: Start, stop, restart, and monitor the MCP server
- **Process Management**: List, monitor, and manage system processes
- **Agent Management**: List, run, and monitor AI agents
- **Workflow Management**: Manage and execute workflows
- **Tool Management**: List, execute, and manage tools
- **Configuration Management**: Get, set, export, and import configurations
- **System Monitoring**: Real-time monitoring with dashboards and alerts
- **Log Management**: View, search, filter, and analyze logs
- **Real-time Updates**: WebSocket-based real-time status updates
- **Interactive Modes**: Interactive dashboards and command modes

## Installation

From the monorepo root:

```bash
pnpm install
pnpm build
```

Or install the CLI package directly:

```bash
pnpm add @repo/mcp-cli
```

## Usage

### Global Options

```bash
mcp-cli [command] [options]

Global Options:
  -v, --verbose           Enable verbose output
  --no-color             Disable colored output
  --format <format>      Output format (table, json, yaml)
  --config <path>        Custom config file path
  --url <url>            Server URL override
  --timeout <ms>         Request timeout in milliseconds
```

### Server Management

```bash
# Start the server
mcp-cli server start

# Stop the server
mcp-cli server stop

# Show server status
mcp-cli server status --watch

# View server logs
mcp-cli server logs --follow
```

### Process Management

```bash
# List all processes
mcp-cli process list

# Monitor top processes
mcp-cli process monitor

# Kill a process
mcp-cli process kill <pid>

# Show system resources
mcp-cli process resources --watch
```

### Agent Management

```bash
# List all agents
mcp-cli agent list --detailed

# Run an agent
mcp-cli agent run code-analyzer --input '{"file": "src/app.ts"}'

# Interactive agent execution
mcp-cli agent interactive code-analyzer

# Show agent performance
mcp-cli agent performance
```

### Workflow Management

```bash
# List workflows
mcp-cli workflow list

# Start a workflow
mcp-cli workflow start code-analysis --wait

# Monitor workflow status
mcp-cli workflow status code-analysis --watch

# Show workflow steps
mcp-cli workflow steps code-analysis --detailed
```

### Tool Management

```bash
# List all tools
mcp-cli tool list --available

# Execute a tool
mcp-cli tool execute code-analysis --params '{"file": "app.ts"}'

# Interactive tool execution
mcp-cli tool interactive code-analysis

# Show tool usage statistics
mcp-cli tool usage --sort count
```

### Configuration Management

```bash
# Get configuration
mcp-cli config get server.url

# Set configuration
mcp-cli config set server.timeout 30000

# Export configuration
mcp-cli config export config.yaml

# Interactive configuration editor
mcp-cli config edit
```

### System Monitoring

```bash
# Show system status
mcp-cli monitor status --watch

# Launch interactive dashboard
mcp-cli monitor dashboard

# Show system metrics
mcp-cli monitor metrics --component server

# View alerts
mcp-cli monitor alerts --active
```

### Log Management

```bash
# View recent logs
mcp-cli log view --lines 100

# Follow logs in real-time
mcp-cli log tail --level error

# Search logs
mcp-cli log search "error" --since 1h

# Advanced log watching
mcp-cli log watch --highlight "error,warning" --alert "critical"
```

### Quick Commands

```bash
# Quick status overview
mcp-cli status --watch

# Health check
mcp-cli health --detailed

# Show version information
mcp-cli version --all
```

## Configuration

The CLI uses a configuration file located at `~/.mcp-cli/config.yaml` by default. You can customize:

- Server connection settings
- Display preferences
- Monitoring thresholds
- Default output formats

## Environment Variables

- `MCP_CLI_SERVER_URL`: Override server URL
- `MCP_CLI_VERBOSE`: Enable verbose mode
- `MCP_CLI_NO_COLOR`: Disable colors
- `MCP_CLI_FORMAT`: Default output format
- `MCP_CLI_CONFIG_DIR`: Config directory path

## Real-time Features

The CLI supports real-time updates through WebSocket connections:

- Live status monitoring
- Real-time log streaming
- Interactive dashboards
- Progress tracking
- Alert notifications

## Output Formats

The CLI supports multiple output formats:

- **Table**: Human-readable tables (default)
- **JSON**: Machine-readable JSON output
- **YAML**: YAML format for configuration files

Use `--format json` or set `MCP_CLI_FORMAT=json` to change the default.

## Examples

### Development Workflow

```bash
# Start the server and monitor
mcp-cli server start --wait
mcp-cli monitor dashboard

# Run code analysis
mcp-cli agent run code-analyzer --interactive

# Check results
mcp-cli workflow list --status completed
```

### Debugging

```bash
# Check system health
mcp-cli health --detailed

# View error logs
mcp-cli log search "error" --since 1h --context 3

# Monitor resources
mcp-cli monitor resources --watch
```

### Configuration Management

```bash
# Backup current config
mcp-cli config export backup.yaml

# Import new configuration
mcp-cli config import new-config.yaml --backup

# Reset to defaults
mcp-cli config reset --client
```

## Advanced Features

### Interactive Dashboard

```bash
mcp-cli monitor dashboard
```

Launches a real-time dashboard with:
- System metrics visualization
- Agent status tables
- Request rate charts
- Alert logs

### Load Testing

```bash
mcp-cli monitor load-test --duration 60 --concurrency 10
```

### Benchmark Testing

```bash
mcp-cli monitor benchmark --test agents --iterations 10
```

## Troubleshooting

### Connection Issues

1. Check server URL: `mcp-cli config get server.url`
2. Test connectivity: `mcp-cli health`
3. Check server status: `mcp-cli server status`

### Performance Issues

1. Monitor resources: `mcp-cli monitor resources`
2. Check metrics: `mcp-cli monitor metrics`
3. View performance analytics: `mcp-cli monitor performance`

### Log Analysis

1. Search for errors: `mcp-cli log search "error" --since 1h`
2. Analyze patterns: `mcp-cli log analyze --type errors`
3. View statistics: `mcp-cli log stats --period 24h`

## Development

To extend the CLI:

1. Add new commands in `src/commands/`
2. Register commands in `src/bin/mcp-cli.ts`
3. Add types in `src/types/`
4. Update API client in `src/services/api-client.ts`

## License

MIT