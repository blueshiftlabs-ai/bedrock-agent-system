# REST API Reference

## Overview

The MCP Hybrid Server exposes a RESTful API for client applications to interact with the system. All endpoints follow REST conventions and return JSON responses.

## Base URL

```
Production: https://api.bedrock-agent.example.com
Staging: https://api-staging.bedrock-agent.example.com
Local: http://localhost:3000
```

## Authentication

All API requests require authentication using Bearer tokens:

```http
Authorization: Bearer <token>
```

## Common Headers

```http
Content-Type: application/json
Accept: application/json
X-Request-ID: <uuid>
```

## Endpoints

### Health Check

#### GET /health
Returns the health status of the server.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "bedrock": "healthy",
    "s3": "healthy"
  }
}
```

### Workflows

#### POST /workflows/execute
Execute a workflow with the specified configuration.

**Request:**
```json
{
  "workflowType": "code-analysis",
  "input": {
    "repository": "https://github.com/example/repo",
    "branch": "main",
    "analysisDepth": 3
  },
  "options": {
    "async": true,
    "priority": "high"
  }
}
```

**Response:**
```json
{
  "workflowId": "wf-123456",
  "status": "started",
  "createdAt": "2024-01-15T10:30:00Z",
  "estimatedDuration": 300
}
```

#### GET /workflows/:id
Get the status and details of a workflow execution.

**Response:**
```json
{
  "workflowId": "wf-123456",
  "type": "code-analysis",
  "status": "in_progress",
  "currentNode": "analyze-dependencies",
  "progress": 65,
  "startedAt": "2024-01-15T10:30:00Z",
  "state": {
    "filesAnalyzed": 150,
    "totalFiles": 230
  }
}
```

#### GET /workflows/:id/results
Retrieve the results of a completed workflow.

**Response:**
```json
{
  "workflowId": "wf-123456",
  "completedAt": "2024-01-15T10:35:00Z",
  "results": {
    "summary": "Analysis complete",
    "metrics": {
      "codeQuality": 8.5,
      "complexity": "medium",
      "coverage": 75
    },
    "recommendations": [
      {
        "type": "refactor",
        "priority": "high",
        "description": "Extract common logic"
      }
    ]
  }
}
```

### Tools

#### GET /mcp/tools
List all available MCP tools.

**Response:**
```json
{
  "tools": [
    {
      "name": "analyze_code",
      "description": "Analyzes source code files",
      "inputSchema": {
        "type": "object",
        "properties": {
          "filePath": { "type": "string" },
          "language": { "type": "string" }
        },
        "required": ["filePath"]
      }
    }
  ]
}
```

#### POST /mcp/tools/:name/execute
Execute a specific MCP tool.

**Request:**
```json
{
  "params": {
    "filePath": "/src/app.ts",
    "language": "typescript"
  }
}
```

**Response:**
```json
{
  "toolName": "analyze_code",
  "executionId": "exec-789",
  "result": {
    "success": true,
    "data": {
      "complexity": 5,
      "issues": [],
      "suggestions": ["Consider using const"]
    }
  },
  "duration": 1250
}
```

### Agents

#### POST /agents/:type/analyze
Invoke a specific agent for analysis.

**Request:**
```json
{
  "input": {
    "content": "SELECT * FROM users WHERE...",
    "context": {
      "database": "postgresql",
      "schema": "public"
    }
  }
}
```

**Response:**
```json
{
  "agentType": "database-analyzer",
  "analysis": {
    "queryType": "select",
    "performance": "suboptimal",
    "suggestions": [
      "Add index on user_id",
      "Use specific columns instead of *"
    ]
  }
}
```

### Files

#### POST /files/upload
Upload files for analysis.

**Request:**
Multipart form data with file field.

**Response:**
```json
{
  "fileId": "file-456",
  "filename": "app.ts",
  "size": 2048,
  "uploadedAt": "2024-01-15T10:30:00Z"
}
```

#### GET /files/:id
Retrieve file metadata.

**Response:**
```json
{
  "fileId": "file-456",
  "filename": "app.ts",
  "size": 2048,
  "mimeType": "text/typescript",
  "uploadedAt": "2024-01-15T10:30:00Z",
  "analysisStatus": "completed"
}
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "repository",
      "reason": "Invalid URL format"
    },
    "requestId": "req-123456",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid request parameters |
| UNAUTHORIZED | 401 | Missing or invalid authentication |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| RATE_LIMIT | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | Service temporarily unavailable |

## Rate Limiting

API requests are rate limited:
- **Anonymous**: 100 requests/hour
- **Authenticated**: 1000 requests/hour
- **Premium**: 10000 requests/hour

Rate limit headers:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1705317600
```

## Pagination

List endpoints support pagination:

```http
GET /workflows?page=2&limit=20
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

## Versioning

The API uses URL versioning:
```
/v1/workflows
/v2/workflows  (future)
```

The current version is indicated in responses:
```http
X-API-Version: v1
```