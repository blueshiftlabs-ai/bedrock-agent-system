# Port Strategy for Bedrock Agent System

## Overview
This document defines the port allocation strategy for the Bedrock Agent System to avoid conflicts with common development ports and provide clear organization.

## Port Allocation Strategy

### UI Applications (3100-3199)
- **3100**: MCP Dashboard (React/Next.js)
- **3101**: Future UI applications
- **3102-3199**: Reserved for additional UI components

### Backend Services (4100-4199)
- **4100**: MCP Memory Server
- **4101**: MCP Hybrid Server (main orchestrator)
- **4102**: MCP Storage Server
- **4103**: MCP Bedrock Server
- **4104-4199**: Reserved for additional microservices

### Database Services (5100-5199)
- **5100**: DynamoDB Local
- **5101**: DynamoDB Admin UI
- **5102**: OpenSearch (primary port)
- **5103**: OpenSearch (secondary port)
- **5104**: Gremlin Server (Neptune local)
- **5105**: Redis (if needed)
- **5106-5199**: Reserved for additional data stores

### Development Tools (6100-6199)
- **6100**: Webpack Dev Server
- **6101**: Storybook
- **6102**: Documentation server
- **6103-6199**: Reserved for dev tools

## Avoided Port Ranges
- **3000-3099**: Common React/Node.js development ports
- **8000-8099**: Common HTTP server ports
- **9000-9099**: Common service ports
- **5000-5099**: Common Flask/Python ports

## Docker Port Mapping Strategy
When running in Docker containers, we use standard internal ports and map to our external port strategy:

```yaml
# Example Docker Compose mapping
services:
  mcp-memory-server:
    ports:
      - "4100:3000"  # External:Internal
  mcp-dashboard:
    ports:
      - "3100:3000"  # External:Internal
  dynamodb-local:
    ports:
      - "5100:8000"  # External:Internal
```

## Hot Reloading in Docker
For development with hot reloading:
1. Mount source code as volumes
2. Use nodemon/webpack dev server inside containers
3. Map ports according to strategy
4. Use Docker Compose override files for dev vs prod

## Environment Configuration
Each service should support port configuration via environment variables:
- `PORT`: Service port (defaults to internal standard)
- `EXTERNAL_PORT`: Used in documentation/links to other services

## Implementation Notes
- All documentation should reference external ports (4100+, 3100+)
- Internal service discovery can use standard ports
- Load balancers/proxies should map to external ports
- Health checks should use external ports