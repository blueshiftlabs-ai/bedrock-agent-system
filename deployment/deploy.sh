#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
STAGE=${1:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")
IMAGE_TAG=${IMAGE_TAG:-latest}
PROJECT_NAME="mcp-hybrid-server"

echo -e "${BLUE}🚀 Deploying MCP Hybrid Server to AWS${NC}"
echo -e "${BLUE}====================================${NC}"
echo -e "${CYAN}Stage: ${STAGE}${NC}"
echo -e "${CYAN}Region: ${AWS_REGION}${NC}"
echo -e "${CYAN}Account: ${AWS_ACCOUNT_ID}${NC}"
echo -e "${CYAN}Image Tag: ${IMAGE_TAG}${NC}"

# Validate stage
if [[ ! "$STAGE" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}❌ Invalid stage: $STAGE. Must be dev, staging, or prod${NC}"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured or credentials invalid${NC}"
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo -e "${YELLOW}⚠️  CDK not found. Installing...${NC}"
    pnpm add -g aws-cdk
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
pnpm install --frozen-lockfile

# Build the application
echo -e "${YELLOW}🔨 Building application...${NC}"
cd apps/mcp-hybrid-server
pnpm build
cd ../..

# Run tests
echo -e "${YELLOW}🧪 Running tests...${NC}"
cd apps/mcp-hybrid-server
pnpm test
cd ../..

# Deploy infrastructure
echo -e "${YELLOW}☁️  Deploying infrastructure...${NC}"
cd infrastructure/mcp-hybrid-stack

# Bootstrap CDK if needed
echo -e "${YELLOW}🏗️  Bootstrapping CDK...${NC}"
cdk bootstrap aws://${AWS_ACCOUNT_ID}/${AWS_REGION}

# Synthesize CloudFormation template
echo -e "${YELLOW}📋 Synthesizing CloudFormation template...${NC}"
cdk synth McpHybridStack-${STAGE}

# Deploy the stack
echo -e "${YELLOW}🚀 Deploying stack: McpHybridStack-${STAGE}${NC}"
cdk deploy McpHybridStack-${STAGE} --require-approval never

# Get stack outputs
echo -e "${YELLOW}📋 Getting stack outputs...${NC}"
SERVICE_URL=$(aws cloudformation describe-stacks \
  --stack-name "McpHybridStack-${STAGE}" \
  --region "${AWS_REGION}" \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceUrl`].OutputValue' \
  --output text 2>/dev/null || echo "Not deployed yet")

DATA_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "McpHybridStack-${STAGE}" \
  --region "${AWS_REGION}" \
  --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' \
  --output text 2>/dev/null || echo "Not deployed yet")

PARAMETER_MANIFEST=$(aws cloudformation describe-stacks \
  --stack-name "McpHybridStack-${STAGE}" \
  --region "${AWS_REGION}" \
  --query 'Stacks[0].Outputs[?OutputKey==`ParameterManifestPath`].OutputValue' \
  --output text 2>/dev/null || echo "")

# Generate environment files from Parameter Store
if [[ -n "$PARAMETER_MANIFEST" && -f "$PARAMETER_MANIFEST" ]]; then
    echo -e "${YELLOW}📝 Generating environment files from Parameter Store...${NC}"
    cd ../..
    
    # Generate .env files for all apps and packages
    export AWS_REGION="$AWS_REGION"
    export STAGE="$STAGE"
    export PARAMETER_STORE_PREFIX="/mcp-hybrid/${STAGE}"
    pnpm build:env:${STAGE}

    # Copy the manifest to the deployment directory
    cp "infrastructure/mcp-hybrid-stack/$PARAMETER_MANIFEST" "deployment/parameter-manifest-${STAGE}.json"
    
    cd infrastructure/mcp-hybrid-stack
fi

cd ../..

# Health check
if [[ "$SERVICE_URL" != "Not deployed yet" ]]; then
    echo -e "${YELLOW}🔍 Performing health check...${NC}"
    sleep 30  # Wait for service to be ready
    
    for i in {1..5}; do
        echo -e "${CYAN}Health check attempt $i/5...${NC}"
        if curl -f "${SERVICE_URL}/api/v1/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Health check passed!${NC}"
            break
        fi
        
        if [ $i -eq 5 ]; then
            echo -e "${YELLOW}⚠️  Health check failed, but deployment may still be in progress${NC}"
        else
            sleep 30
        fi
    done
fi

# Retrieve key parameters from Parameter Store
echo -e "${YELLOW}📋 Retrieving key parameters from Parameter Store...${NC}"
PARAMETERS=$(aws ssm get-parameters-by-path \
    --path "/mcp-hybrid/${STAGE}" \
    --recursive \
    --query 'Parameters[?contains(Name, `/alb/url`) || contains(Name, `/neptune/cluster/endpoint`) || contains(Name, `/opensearch/collection/endpoint`)].[Name,Value]' \
    --output json \
    --region "$AWS_REGION" 2>/dev/null || echo "[]")

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}🌐 Service URL: ${SERVICE_URL}${NC}"
echo -e "${GREEN}🔧 MCP Endpoint: ${SERVICE_URL}/mcp${NC}"
echo -e "${GREEN}📚 API Documentation: ${SERVICE_URL}/api/docs${NC}"
echo -e "${GREEN}💗 Health Check: ${SERVICE_URL}/api/v1/health${NC}"
echo -e "${GREEN}🗄️  Data Bucket: ${DATA_BUCKET}${NC}"

# Display key parameters
if [[ "$PARAMETERS" != "[]" ]]; then
    echo -e "${BLUE}======================================${NC}"
    echo -e "${GREEN}🔑 Key Parameters:${NC}"
    echo "$PARAMETERS" | jq -r '.[] | "   \(.0): \(.1)"'
fi

echo -e "${BLUE}======================================${NC}"

# Save deployment info
cat > deployment-info-${STAGE}.json << EOF
{
  "stage": "${STAGE}",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "region": "${AWS_REGION}",
  "accountId": "${AWS_ACCOUNT_ID}",
  "serviceUrl": "${SERVICE_URL}",
  "dataBucket": "${DATA_BUCKET}",
  "imageTag": "${IMAGE_TAG}",
  "parameterStorePrefix": "/mcp-hybrid/${STAGE}",
  "parameterManifest": "parameter-manifest-${STAGE}.json"
}
EOF

echo -e "${CYAN}💡 To retrieve environment variables, run:${NC}"
echo -e "${CYAN}   cd infrastructure/mcp-hybrid-stack${NC}"
echo -e "${CYAN}   pnpm build-env generate --manifest parameter-manifest-${STAGE}.json --region ${AWS_REGION}${NC}"