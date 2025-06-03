#!/bin/bash

# Setup AWS Parameters for Bedrock Agent System
# This script helps initialize AWS Parameter Store and Secrets Manager values

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=${1:-dev}
REGION=${2:-us-east-1}
PARAM_PREFIX="/bedrock-agent-system"
SECRET_PREFIX="bedrock-agent-system"

echo -e "${GREEN}🚀 Setting up AWS parameters for environment: ${ENVIRONMENT}${NC}"
echo -e "${GREEN}📍 Region: ${REGION}${NC}"
echo ""

# Function to create parameter
create_parameter() {
    local name=$1
    local value=$2
    local type=${3:-String}
    local description=${4:-""}
    
    full_path="${PARAM_PREFIX}/${ENVIRONMENT}/${name}"
    
    echo -ne "Creating parameter ${full_path}... "
    
    if aws ssm put-parameter \
        --name "${full_path}" \
        --value "${value}" \
        --type "${type}" \
        --description "${description}" \
        --overwrite \
        --region "${REGION}" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
}

# Function to create secret
create_secret() {
    local name=$1
    local value=$2
    local description=${3:-""}
    
    full_name="${SECRET_PREFIX}/${ENVIRONMENT}/${name}"
    
    echo -ne "Creating secret ${full_name}... "
    
    # Check if secret exists
    if aws secretsmanager describe-secret --secret-id "${full_name}" --region "${REGION}" >/dev/null 2>&1; then
        # Update existing secret
        if aws secretsmanager update-secret \
            --secret-id "${full_name}" \
            --secret-string "${value}" \
            --region "${REGION}" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ (updated)${NC}"
        else
            echo -e "${RED}✗${NC}"
        fi
    else
        # Create new secret
        if aws secretsmanager create-secret \
            --name "${full_name}" \
            --secret-string "${value}" \
            --description "${description}" \
            --region "${REGION}" >/dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC}"
        fi
    fi
}

# Check AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity --region "${REGION}" >/dev/null 2>&1; then
    echo -e "${RED}❌ AWS credentials not configured or invalid.${NC}"
    exit 1
fi

echo -e "${YELLOW}📝 Creating AWS Parameters...${NC}"
echo ""

# AWS Configuration
create_parameter "AWS_REGION" "${REGION}" "String" "AWS Region for services"
create_parameter "AWS_ACCOUNT_ID" "$(aws sts get-caller-identity --query Account --output text)" "String" "AWS Account ID"

# Application Configuration
create_parameter "PORT" "3000" "String" "Application port"
create_parameter "HOST" "0.0.0.0" "String" "Application host"
create_parameter "API_PREFIX" "api" "String" "API prefix"
create_parameter "CORS_ORIGINS" "*" "String" "CORS allowed origins"

# Database Configuration
create_parameter "DYNAMODB_TABLE_PREFIX" "bedrock-agent-${ENVIRONMENT}" "String" "DynamoDB table prefix"
create_parameter "DYNAMODB_REGION" "${REGION}" "String" "DynamoDB region"

# S3 Configuration
create_parameter "S3_BUCKET_NAME" "bedrock-agent-${ENVIRONMENT}-storage" "String" "S3 bucket name"
create_parameter "S3_REGION" "${REGION}" "String" "S3 region"

# OpenSearch Configuration (placeholders)
create_parameter "OPENSEARCH_ENDPOINT" "https://opensearch-${ENVIRONMENT}.example.com" "String" "OpenSearch endpoint"
create_parameter "OPENSEARCH_REGION" "${REGION}" "String" "OpenSearch region"

# Neptune Configuration (placeholders)
create_parameter "NEPTUNE_ENDPOINT" "neptune-${ENVIRONMENT}.example.com" "String" "Neptune endpoint"
create_parameter "NEPTUNE_PORT" "8182" "String" "Neptune port"
create_parameter "NEPTUNE_REGION" "${REGION}" "String" "Neptune region"

# Bedrock Configuration
create_parameter "BEDROCK_REGION" "${REGION}" "String" "Bedrock region"
create_parameter "BEDROCK_MODEL_ID" "anthropic.claude-3-sonnet-20240229-v1:0" "String" "Bedrock model ID"
create_parameter "BEDROCK_MAX_TOKENS" "4096" "String" "Bedrock max tokens"
create_parameter "BEDROCK_TEMPERATURE" "0.7" "String" "Bedrock temperature"

# Logging Configuration
create_parameter "LOG_LEVEL" "info" "String" "Log level"
create_parameter "LOG_FORMAT" "json" "String" "Log format"

# Feature Flags
create_parameter "ENABLE_MEMORY_MODULE" "true" "String" "Enable memory module"
create_parameter "ENABLE_INDEXING_MODULE" "true" "String" "Enable indexing module"
create_parameter "ENABLE_KNOWLEDGE_GRAPH" "true" "String" "Enable knowledge graph"

# Performance Configuration
create_parameter "MAX_CONCURRENT_WORKFLOWS" "10" "String" "Max concurrent workflows"
create_parameter "WORKFLOW_TIMEOUT_MS" "300000" "String" "Workflow timeout in ms"
create_parameter "AGENT_TIMEOUT_MS" "60000" "String" "Agent timeout in ms"

# Dashboard Configuration
create_parameter "NEXT_PUBLIC_API_URL" "http://localhost:3000/api" "String" "Dashboard API URL"
create_parameter "NEXT_PUBLIC_WS_URL" "ws://localhost:3000" "String" "Dashboard WebSocket URL"
create_parameter "NEXT_PUBLIC_AUTH_ENABLED" "false" "String" "Dashboard auth enabled"

# CLI Configuration
create_parameter "MCP_SERVER_URL" "http://localhost:3000" "String" "MCP server URL"
create_parameter "MCP_API_PREFIX" "api" "String" "MCP API prefix"

echo ""
echo -e "${YELLOW}🔐 Creating AWS Secrets...${NC}"
echo ""

# Generate random secrets
API_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 64)
ENCRYPTION_KEY=$(openssl rand -hex 32)
NEXTAUTH_SECRET=$(openssl rand -hex 32)

# Create secrets
create_secret "API_KEY" "${API_KEY}" "API Key for authentication"
create_secret "JWT_SECRET" "${JWT_SECRET}" "JWT signing secret"
create_secret "ENCRYPTION_KEY" "${ENCRYPTION_KEY}" "Encryption key for sensitive data"
create_secret "OPENSEARCH_USERNAME" "admin" "OpenSearch username"
create_secret "OPENSEARCH_PASSWORD" "changeme" "OpenSearch password"
create_secret "NEXTAUTH_SECRET" "${NEXTAUTH_SECRET}" "NextAuth secret"
create_secret "NEXTAUTH_URL" "http://localhost:3001" "NextAuth URL"
create_secret "CLI_API_KEY" "${API_KEY}" "CLI API key"

echo ""
echo -e "${GREEN}✅ AWS parameters setup complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Run 'pnpm build:env:${ENVIRONMENT}' to generate .env files"
echo "2. Review and update any placeholder values in AWS Parameter Store"
echo "3. Update secrets in AWS Secrets Manager with production values"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "- Generated API keys and secrets are random - save them securely"
echo "- Update OpenSearch and Neptune endpoints when services are deployed"
echo "- Configure proper CORS origins for production"