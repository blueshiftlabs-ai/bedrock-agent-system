# MCP Memory Server

A sophisticated memory server implementing the Model Context Protocol (MCP) with support for multi-layer storage, advanced embeddings, and graph relationships.

## Features

- **Multi-Layer Storage**: OpenSearch (vector similarity), DynamoDB/LocalStorage (metadata), Neptune/Gremlin (graph relationships)
- **Advanced Embeddings**: Supports both AWS Bedrock and local transformer models (CodeBERT, GraphCodeBERT, all-MiniLM-L6-v2)
- **Graph-Aware Code Analysis**: Enhanced embeddings for code with structural context
- **Sophisticated Port Strategy**: Professional port allocation avoiding common conflicts

## Development Modes

### 🏠 Local Development Mode
Perfect for pure local development with mocked services:

```bash
# Watch mode for local development
npm run dev:local

# Production build for local testing
npm run start:local
```

**Features:**
- Local JSON file storage (no AWS required)
- Local transformer embeddings
- Mocked AWS services
- Port 4100 with local database services on 5100-5104

### 🌐 Server Development Mode  
For development with real AWS services:

```bash
# Watch mode with AWS services
npm run dev:server

# Production build with AWS services
npm run start:dev
```

**Features:**
- Real DynamoDB, OpenSearch, Neptune
- AWS Bedrock embeddings
- Full AWS integration
- Development-optimized settings

### 🚀 Production Mode
For production deployment:

```bash
npm run start:prod
```

**Features:**
- Production-optimized configurations
- Enhanced security settings
- Performance tuning
- Metrics and monitoring

## Quick Start

### Local Development Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Start local services (optional):**
```bash
# Start OpenSearch
docker run -p 5102:9200 -p 5112:9600 -e "discovery.type=single-node" opensearchproject/opensearch:2.11.0

# Start Gremlin Server
docker run -p 5104:8182 tinkerpop/gremlin-server:3.7.0

# Start DynamoDB Local (optional - will use JSON files if not available)
docker run -p 5100:8000 amazon/dynamodb-local:latest
```

3. **Start the memory server:**
```bash
npm run dev:local
```

4. **Test the server:**
```bash
curl -X POST http://localhost:4100/memory/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "store-memory",
      "arguments": {
        "content": "Test memory storage",
        "agent_id": "test-agent",
        "type": "semantic",
        "content_type": "text"
      }
    },
    "id": 1
  }'
```

## Port Strategy

The memory server follows a professional port allocation strategy:

- **4100**: MCP Memory Server
- **5100**: DynamoDB Local
- **5101**: DynamoDB Admin UI
- **5102**: OpenSearch (primary port)
- **5112**: OpenSearch (secondary port)
- **5104**: Gremlin Server

See `docs/PORT_STRATEGY.md` for complete documentation.

## Configuration

### Environment Files

The server supports multiple environment configurations:

- `.env.local` - Local development with mocked services
- `.env.development` - Development with real AWS services  
- `.env.production` - Production deployment

### Key Environment Variables

| Variable | Local | Development | Production | Description |
|----------|-------|-------------|------------|-------------|
| `MEMORY_MODE` | `local` | `server` | `server` | Deployment mode |
| `USE_LOCAL_STORAGE` | `true` | `false` | `false` | Use JSON files vs DynamoDB |
| `BEDROCK_ENABLED` | `false` | `true` | `true` | Enable AWS Bedrock embeddings |
| `ENABLE_TRANSFORMER_EMBEDDINGS` | `true` | `false` | `false` | Use local transformer models |

## API Endpoints

### MCP Protocol
- `POST /memory/mcp` - Main MCP endpoint for tool calls
- `GET /memory/mcp` - MCP server information
- `DELETE /memory/mcp` - Reset MCP state

### Memory Operations
- `POST /memory/memory/store` - Store memory
- `POST /memory/memory/retrieve` - Retrieve memories
- `POST /memory/memory/search` - Search memories
- `DELETE /memory/memory/:id` - Delete memory

### Health & Monitoring
- `GET /memory/health` - Health check
- `GET /memory/memory/statistics` - Memory statistics

## Advanced Features

### Graph-Aware Code Embeddings

The server supports enhanced code embeddings with structural context:

```javascript
// Example: Storing code with structural context
{
  "content": "function calculateFibonacci(n) { ... }",
  "content_type": "code",
  "programming_language": "javascript",
  "structural_context": {
    "functions": ["calculateFibonacci"],
    "callGraph": { "calculateFibonacci": ["Math.max"] }
  }
}
```

### Multi-Layer Storage Architecture

1. **OpenSearch**: Vector similarity search using embeddings
2. **DynamoDB/LocalStorage**: Metadata and session management
3. **Neptune/Gremlin**: Graph relationships and connections

### Embedding Models

- **Production**: AWS Bedrock Titan models
- **Local Development**: Transformer.js models
  - Text: `all-MiniLM-L6-v2`
  - Code: `codebert-base` (with GraphCodeBERT enhancement)
  - Fallback: Hash-based embeddings

## Testing

### Local Testing
```bash
npm run test:local
```

### Server Testing  
```bash
npm run test:server
```

### Manual Testing
```bash
# Health check
curl http://localhost:4100/memory/health

# Store a memory
curl -X POST http://localhost:4100/memory/mcp -H "Content-Type: application/json" -d '...'
```

## Deployment

### Docker
```bash
# Build image
npm run docker:build

# Run container
npm run docker:run
```

### Production Deployment
1. Set up AWS infrastructure (DynamoDB, OpenSearch, Neptune)
2. Configure environment variables
3. Deploy with `npm run start:prod`

## Troubleshooting

### Port Conflicts
If you encounter port conflicts, check:
- Port 4100 is available for the memory server
- Ports 5100-5104 are available for local database services

### Service Connectivity
- Ensure OpenSearch is running on port 5102
- Ensure Gremlin server is running on port 5104
- Check AWS credentials for server mode

### Embedding Issues
- In local mode: Transformer models download automatically
- In server mode: Ensure AWS Bedrock access is configured
- Fallback: Hash-based embeddings will be used if models fail

## Contributing

See the main project documentation for contribution guidelines.

## License

See the main project LICENSE file.