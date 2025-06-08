#!/bin/bash

set -e

echo "🔧 Setting up local development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed."; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Set up environment file
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "✅ Environment file created. Please update .env with your configuration."
fi

# Start LocalStack and other services
echo "🐳 Starting development services..."
docker-compose -f docker/docker-compose.dev.yml up -d localstack redis

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Create LocalStack resources
echo "🏗️  Setting up LocalStack resources..."
aws --endpoint-url=http://localhost:4566 s3 mb s3://mcp-hybrid-dev-bucket || true
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
    --table-name MCPMetadata-dev \
    --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
    --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST || true

aws --endpoint-url=http://localhost:4566 dynamodb create-table \
    --table-name MCPWorkflowState-dev \
    --attribute-definitions AttributeName=workflowId,AttributeType=S AttributeName=timestamp,AttributeType=N \
    --key-schema AttributeName=workflowId,KeyType=HASH AttributeName=timestamp,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST || true

echo "✅ Local development environment is ready!"
echo "🚀 You can now run: pnpm run start:dev"
