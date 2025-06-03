# MCP Dashboard

A modern, AI-powered dashboard for managing and monitoring MCP (Model Context Protocol) hybrid server systems.

## Features

### Core Dashboard Components

- **Dashboard Overview**: Real-time system status, alerts, and health monitoring
- **Process Monitoring**: Monitor running processes, memory/CPU usage, and process management
- **MCP Server Management**: Add, configure, and manage multiple MCP server instances
- **Real-time Logs**: Live log streaming with filtering and search capabilities
- **Workflow Management**: Create, monitor, and manage complex multi-step workflows
- **Tool Registry**: Browse and manage available tools with configuration options
- **AI Assistant**: Natural language interface for system queries and assistance
- **Connection Settings**: Configure connections to different MCP server instances

### AI-Powered Features

- **Natural Language Queries**: Ask questions about system performance in plain English
- **Intelligent Log Analysis**: AI-powered log pattern recognition and issue identification
- **AI-Assisted Workflow Creation**: Get help building complex workflows with natural language
- **Smart Troubleshooting**: AI guidance for diagnosing and resolving system issues

### Real-time Capabilities

- **WebSocket Integration**: Live updates for processes, logs, workflows, and system status
- **Real-time Monitoring**: Continuous monitoring of system health and performance
- **Live Log Streaming**: Real-time log viewing with pause/resume functionality
- **Dynamic Updates**: Automatic refresh of dashboard components

## Technology Stack

- **Frontend**: Next.js 14 with App Router, React 18, TypeScript
- **Styling**: Tailwind CSS with custom component library
- **State Management**: Zustand with persistence
- **Real-time**: Socket.IO client for WebSocket connections
- **AI Integration**: Vercel AI SDK with OpenAI GPT-3.5/4
- **Data Fetching**: TanStack Query for server state management
- **UI Components**: Radix UI primitives with custom styling

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- An OpenAI API key for AI features
- A running MCP hybrid server instance

### Installation

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and add your configuration:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   NEXT_PUBLIC_MCP_SERVER_URL=http://localhost:3000
   NEXT_PUBLIC_WS_SERVER_URL=ws://localhost:3000
   ```

3. **Start the development server**:
   ```bash
   pnpm dev
   ```

4. **Open the dashboard**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### Configuration

#### MCP Server Connection

1. Click the settings gear icon in the bottom-right corner
2. Configure your MCP server connection:
   - **Server URL**: The HTTP endpoint of your MCP server
   - **API Key**: Optional authentication token
   - **Timeout**: Request timeout in milliseconds
   - **Reconnect Settings**: Configure automatic reconnection

#### Adding MCP Servers

1. Go to the "Servers" tab
2. Click "Add Server"
3. Fill in the server details:
   - Name and URL
   - Protocol (HTTP/HTTPS/WebSocket)
   - Authentication token (if required)
   - Connection settings

## Usage Guide

### Dashboard Overview

The main dashboard provides a bird's-eye view of your MCP system:

- **System Status**: Overall health indicator
- **Server Count**: Number of connected MCP servers
- **Active Processes**: Currently running processes
- **Running Workflows**: Active workflow executions
- **Recent Alerts**: Critical system alerts

### Process Monitoring

Monitor and manage system processes:

- View real-time CPU and memory usage
- Start, stop, and restart processes
- Monitor process uptime and restart counts
- Filter and search processes

### Workflow Management

Create and manage complex workflows:

- **Visual Workflow Builder**: Drag-and-drop workflow creation
- **Step Configuration**: Configure agents, tools, and decision points
- **Real-time Monitoring**: Watch workflows execute in real-time
- **Performance Metrics**: Analyze workflow performance

### AI Assistant

Leverage AI for system management:

- **General Chat**: Ask questions about system status
- **Log Analysis**: Get AI insights from log patterns
- **Workflow Creation**: Get help building workflows
- **Troubleshooting**: AI-guided problem resolution

Example queries:
- "What processes are using the most memory?"
- "Analyze the recent error logs"
- "Create a workflow for database backup"
- "Why is my server responding slowly?"

### Log Viewer

Monitor system logs in real-time:

- **Live Streaming**: Real-time log updates
- **Filtering**: Filter by log level, source, and content
- **Search**: Full-text search across log messages
- **Pause/Resume**: Control log streaming

### Tool Registry

Manage available tools:

- **Browse Tools**: View all registered tools by category
- **Tool Configuration**: Modify tool settings and permissions
- **Usage Analytics**: Monitor tool usage patterns
- **Activation Control**: Enable/disable tools as needed

## Development

### Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main dashboard page
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── dashboard/        # Dashboard components
│   ├── monitoring/       # Process monitoring
│   ├── servers/          # Server management
│   ├── logs/            # Log viewer
│   ├── workflows/       # Workflow management
│   ├── tools/           # Tool registry
│   ├── ai/              # AI assistant
│   └── settings/        # Settings components
├── lib/                  # Utility functions
├── hooks/               # Custom React hooks
├── store/               # State management
└── types/               # TypeScript definitions
```

### Building

```bash
# Build for production
pnpm build

# Start production server
pnpm start

# Type checking
pnpm type-check

# Linting
pnpm lint
```

### Docker Support

Build and run with Docker:

```bash
# Build image
docker build -t mcp-dashboard .

# Run container
docker run -p 3000:3000 mcp-dashboard
```

## Integration with MCP Hybrid Server

This dashboard is designed to work with the MCP Hybrid Server. Ensure your server exposes the following endpoints:

### WebSocket Events

- `system_status` - Overall system health
- `process_update` - Process status changes
- `log_entry` - New log entries
- `workflow_update` - Workflow status changes
- `tool_update` - Tool registry changes

### API Endpoints

- `GET /api/processes` - List processes
- `GET /api/workflows` - List workflows
- `GET /api/tools` - List tools
- `POST /api/workflows` - Create workflow
- `PUT /api/processes/:id` - Control processes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is part of the Bedrock Agent System monorepo. See the main repository for license information.