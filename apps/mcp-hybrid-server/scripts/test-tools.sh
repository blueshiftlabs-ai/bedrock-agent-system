#!/bin/bash

set -e

echo "🧪 Testing MCP tools..."

BASE_URL=${1:-http://localhost:3000}

# Test health endpoint
echo "🔍 Testing health endpoint..."
curl -f "$BASE_URL/api/v1/health" || { echo "❌ Health check failed"; exit 1; }

# Test tool listing
echo "🔍 Testing tool listing..."
curl -f "$BASE_URL/api/v1/tools" || { echo "❌ Tool listing failed"; exit 1; }

# Test code analysis tool
echo "🔍 Testing code analysis tool..."
curl -X POST "$BASE_URL/api/v1/tools/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "analyze-code-file",
    "parameters": {
      "filePath": "s3://example-file.ts",
      "includeMetrics": true
    }
  }' || { echo "❌ Code analysis tool test failed"; exit 1; }

echo "✅ All tool tests passed!"
