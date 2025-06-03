# Bedrock Agent System Documentation

## Overview

Welcome to the comprehensive documentation for the Bedrock Agent System, a sophisticated microservice platform that combines Model Context Protocol (MCP) with advanced AI capabilities using NestJS and LangGraph. This system is designed for production-scale code analysis, documentation generation, and knowledge management.

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 8+
- Docker 20+
- AWS CLI 2+

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/bedrock-agent-system.git
cd bedrock-agent-system

# Install dependencies
pnpm install

# Setup development environment
pnpm --filter @apps/mcp-hybrid-server run setup-local-dev

# Start the application
pnpm app:dev
```

For detailed setup instructions, see the [Deployment Guide](deployment/DEPLOYMENT_GUIDE.md).

## Documentation Structure

### Core Documentation

#### [Architecture Overview](ARCHITECTURE.md)
Comprehensive overview of the system architecture, including:
- System components and their interactions
- Data flow diagrams
- Technology stack details
- Deployment architecture
- Security architecture

#### [API Reference](api/API_REFERENCE.md)
Complete API documentation covering:
- Authentication methods
- Endpoint specifications
- Request/response formats
- Error handling
- Rate limiting
- WebSocket API
- MCP protocol implementation

#### [Deployment Guide](deployment/DEPLOYMENT_GUIDE.md)
Step-by-step deployment instructions for:
- Local development setup
- Staging deployments
- Production deployments
- AWS infrastructure setup
- Docker containerization
- Kubernetes deployment
- Monitoring and scaling

### Specialized Guides

#### [Developer Guide](DEVELOPER_GUIDE.md)
Comprehensive guide for developers working on the system:
- Development environment setup
- Creating custom agents and tools
- Workflow development
- Memory system integration
- Testing strategies
- Code style and standards
- Performance optimization
- Contributing guidelines

#### [Security Guidelines](SECURITY.md)
Security best practices and implementation details:
- Authentication and authorization
- Data protection and encryption
- Network security
- AWS security best practices
- MCP protocol security
- Secrets management
- Monitoring and incident response
- Compliance and auditing

#### [Performance Optimization](PERFORMANCE_OPTIMIZATION.md)
Performance tuning and optimization strategies:
- Application optimization
- Database optimization
- Caching strategies
- Memory management
- Network optimization
- AWS service optimization
- Monitoring and profiling
- Scaling strategies

#### [Troubleshooting Guide](TROUBLESHOOTING.md)
Comprehensive troubleshooting procedures:
- Common issues and solutions
- Diagnostic tools and techniques
- Configuration problems
- Performance issues
- Network and connectivity
- AWS service issues
- MCP protocol troubleshooting
- Recovery procedures

### Integration Documentation

#### [MCP Bidirectional Setup](MCP_BIDIRECTIONAL_SETUP.md)
Detailed guide for setting up bidirectional MCP communication:
- MCP server configuration
- MCP client setup
- Hybrid mode operation
- Health monitoring
- Configuration management
- Troubleshooting MCP issues

## Key Features

### 🔄 Hybrid MCP Support
- **MCP Server**: Expose AI tools to external MCP clients
- **MCP Client**: Connect to external MCP servers for enhanced capabilities
- **Bidirectional Communication**: Simultaneous server and client operation

### 🤖 AI-Powered Analysis
- **Code Analysis**: Advanced static code analysis and pattern detection
- **Database Analysis**: Schema analysis and optimization recommendations
- **Documentation Generation**: Automated documentation creation
- **Knowledge Management**: Graph-based knowledge representation

### 🔀 Workflow Orchestration
- **LangGraph Integration**: Complex multi-step AI workflows
- **State Management**: Persistent workflow state with checkpointing
- **Error Recovery**: Automatic error handling and workflow resumption
- **Parallel Execution**: Efficient parallel processing of workflow steps

### 💾 Memory System
- **Vector Search**: Semantic similarity search using OpenSearch
- **Context Management**: Intelligent context retrieval for AI agents
- **Knowledge Graphs**: Structured knowledge representation with Neptune
- **Memory Persistence**: Long-term memory storage and retrieval

### ☁️ Cloud-Native Architecture
- **AWS Integration**: Full integration with AWS services (Bedrock, DynamoDB, S3)
- **Auto Scaling**: Automatic horizontal and vertical scaling
- **High Availability**: Multi-AZ deployment with failover capabilities
- **Monitoring**: Comprehensive monitoring and observability

## Getting Started

### 1. Development Setup

Follow the [Developer Guide](DEVELOPER_GUIDE.md) for detailed setup instructions:

```bash
# Install dependencies
pnpm install

# Setup local environment
./scripts/setup-local-dev.sh

# Start LocalStack for AWS services
docker-compose -f docker-compose.localstack.yml up -d

# Start development server
pnpm dev
```

### 2. Basic Usage

#### API Access
```bash
# Health check
curl http://localhost:3000/api/v1/health

# Create a workflow
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "code_analysis",
    "parameters": {
      "filePath": "/path/to/code.js"
    }
  }'
```

#### MCP Integration
```bash
# MCP server endpoint
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### 3. Configuration

#### Environment Variables
```bash
# Server Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# AWS Configuration
AWS_REGION=us-east-1
DYNAMODB_METADATA_TABLE=MCPMetadata-dev
AWS_S3_BUCKET=mcp-data-dev

# MCP Configuration
MCP_SERVER_ENABLED=true
MCP_CLIENT_ENABLED=true
```

#### MCP Server Configuration
```bash
# Initialize MCP configuration
./scripts/mcp-config.sh init

# Add external MCP servers
./scripts/mcp-config.sh add filesystem "Local Files"
./scripts/mcp-config.sh add sequential-thinking
```

## Architecture Highlights

### Component Overview
```
┌─────────────────────────────────────────────────────┐
│                 Bedrock Agent System                │
├─────────────────────────────────────────────────────┤
│  API Layer    │ Workflow Engine │ Agent System      │
│  - REST API   │ - LangGraph     │ - Code Analyzer   │
│  - MCP Server │ - State Mgmt    │ - DB Analyzer     │
│  - WebSocket  │ - Checkpoints   │ - Knowledge AI    │
├─────────────────────────────────────────────────────┤
│  Integration Layer                                  │
│  - AWS Bedrock  │ MCP Client  │ Memory System      │
│  - DynamoDB     │ - External  │ - Vector Search    │
│  - S3 Storage   │   Servers   │ - Graph DB         │
└─────────────────────────────────────────────────────┘
```

### Key Design Patterns

#### 1. **Agent-Based Architecture**
- Specialized AI agents for different analysis tasks
- Extensible agent framework for custom implementations
- Context-aware agent execution with memory integration

#### 2. **Tool Registry System**
- Dynamic tool registration and discovery
- MCP-compatible tool interface
- Performance monitoring and caching

#### 3. **Workflow State Management**
- Persistent workflow state with DynamoDB
- Checkpoint-based recovery
- Parallel execution optimization

#### 4. **Memory-Augmented AI**
- Vector-based semantic search
- Context injection for improved AI responses
- Knowledge graph integration

## Use Cases

### 1. Code Analysis and Documentation
```javascript
// Analyze codebase
const workflow = await client.workflows.create({
  type: 'code_analysis',
  parameters: {
    repositoryPath: '/path/to/repo',
    analysisDepth: 'comprehensive'
  }
});

// Generate documentation
const docs = await client.agents.execute('documentation-generator', {
  prompt: 'Generate API documentation',
  context: { analysisResults: workflow.result }
});
```

### 2. Database Schema Analysis
```javascript
// Analyze database schema
const analysis = await client.tools.execute('database_analysis', {
  connectionString: 'postgresql://...',
  analysisType: 'schema_optimization'
});
```

### 3. Knowledge Management
```javascript
// Build knowledge graph
const knowledge = await client.agents.execute('knowledge-builder', {
  prompt: 'Extract entities and relationships',
  context: { documents: documentSet }
});

// Query knowledge
const insights = await client.memory.search({
  query: 'microservice patterns',
  limit: 10,
  threshold: 0.8
});
```

### 4. MCP Tool Integration
```javascript
// Use external MCP tools
const mcpResult = await client.mcp.callTool('filesystem', 'read_file', {
  path: '/path/to/file.txt'
});
```

## Performance Characteristics

### Benchmarks
- **API Response Time**: < 2 seconds (95th percentile)
- **Workflow Execution**: 30-300 seconds (depending on complexity)
- **Memory Usage**: < 2GB per container under normal load
- **Throughput**: 1000+ requests per minute
- **Availability**: 99.9% uptime SLA

### Scaling Capabilities
- **Horizontal Scaling**: Auto-scaling up to 20 instances
- **Vertical Scaling**: CPU and memory optimization
- **Database Scaling**: DynamoDB auto-scaling
- **Storage Scaling**: S3 with intelligent tiering

## Security Features

### Authentication & Authorization
- API key authentication
- JWT token support
- Role-based access control (RBAC)
- MCP client whitelisting

### Data Protection
- Encryption at rest (DynamoDB, S3)
- Encryption in transit (TLS 1.3)
- PII detection and sanitization
- Data classification and handling

### Infrastructure Security
- VPC isolation with private subnets
- Security groups and NACLs
- WAF protection
- Comprehensive audit logging

## Monitoring and Observability

### Health Monitoring
```bash
# Overall health
GET /api/v1/health

# Component-specific health
GET /api/v1/health/mcp
GET /api/v1/health/database
GET /api/v1/health/bedrock
```

### Metrics and Alerting
- Real-time performance metrics
- Error rate monitoring
- Resource utilization tracking
- Custom business metrics

### Logging
- Structured JSON logging
- Correlation IDs for request tracking
- CloudWatch integration
- Security event logging

## Contributing

We welcome contributions! Please see our [Developer Guide](DEVELOPER_GUIDE.md) for details on:

- Development setup
- Code style guidelines
- Testing requirements
- Pull request process
- Issue reporting

### Quick Contribution Setup
```bash
# Fork and clone the repository
git clone https://github.com/your-username/bedrock-agent-system.git

# Create a feature branch
git checkout -b feature/your-feature-name

# Make changes and test
pnpm test
pnpm lint

# Submit a pull request
```

## Support and Resources

### Documentation
- [Architecture Overview](ARCHITECTURE.md) - System design and components
- [API Reference](api/API_REFERENCE.md) - Complete API documentation
- [Developer Guide](DEVELOPER_GUIDE.md) - Development best practices
- [Deployment Guide](deployment/DEPLOYMENT_GUIDE.md) - Deployment instructions

### Community
- GitHub Issues - Bug reports and feature requests
- GitHub Discussions - Community discussions and Q&A
- Documentation Feedback - Improvements and suggestions

### Commercial Support
For enterprise support, custom development, and professional services, please contact our support team.

## License

This project is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.

## Acknowledgments

- **NestJS** - Progressive Node.js framework
- **LangGraph** - Workflow orchestration for AI applications
- **AWS Bedrock** - Managed AI model hosting
- **Model Context Protocol** - Standardized AI tool integration
- **OpenAPI/Swagger** - API documentation standards

---

**Ready to get started?** Follow our [Quick Start Guide](#quick-start) or dive into the [Developer Guide](DEVELOPER_GUIDE.md) for detailed setup instructions.