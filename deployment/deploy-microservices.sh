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
PROJECT_NAME="mcp-hybrid-microservices"

echo -e "${BLUE}🚀 Deploying MCP Hybrid Microservices to AWS${NC}"
echo -e "${BLUE}=============================================${NC}"
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
    npm install -g aws-cdk
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
echo -e "${YELLOW}☁️  Deploying microservices infrastructure...${NC}"
cd infrastructure/mcp-hybrid-stack

# Bootstrap CDK if needed
echo -e "${YELLOW}🏗️  Bootstrapping CDK...${NC}"
cdk bootstrap aws://${AWS_ACCOUNT_ID}/${AWS_REGION}

# Synthesize CloudFormation template
echo -e "${YELLOW}📋 Synthesizing CloudFormation template...${NC}"
cdk synth McpMicroservicesStack-${STAGE}

# Deploy the microservices stack
echo -e "${YELLOW}🚀 Deploying microservices stack: McpMicroservicesStack-${STAGE}${NC}"
cdk deploy McpMicroservicesStack-${STAGE} --require-approval never

# Get stack outputs
echo -e "${YELLOW}📋 Getting stack outputs...${NC}"
MAIN_URL=$(aws cloudformation describe-stacks \
  --stack-name "McpMicroservicesStack-${STAGE}" \
  --region "${AWS_REGION}" \
  --query 'Stacks[0].Outputs[?OutputKey==`MainServiceUrl`].OutputValue' \
  --output text 2>/dev/null || echo "Not deployed yet")

GATEWAY_URL=$(aws cloudformation describe-stacks \
  --stack-name "McpMicroservicesStack-${STAGE}" \
  --region "${AWS_REGION}" \
  --query 'Stacks[0].Outputs[?OutputKey==`apigatewayServiceUrl`].OutputValue' \
  --output text 2>/dev/null || echo "Not deployed yet")

AGENTS_URL=$(aws cloudformation describe-stacks \
  --stack-name "McpMicroservicesStack-${STAGE}" \
  --region "${AWS_REGION}" \
  --query 'Stacks[0].Outputs[?OutputKey==`agentsServiceUrl`].OutputValue' \
  --output text 2>/dev/null || echo "Not deployed yet")

TOOLS_URL=$(aws cloudformation describe-stacks \
  --stack-name "McpMicroservicesStack-${STAGE}" \
  --region "${AWS_REGION}" \
  --query 'Stacks[0].Outputs[?OutputKey==`toolsServiceUrl`].OutputValue' \
  --output text 2>/dev/null || echo "Not deployed yet")

WORKFLOWS_URL=$(aws cloudformation describe-stacks \
  --stack-name "McpMicroservicesStack-${STAGE}" \
  --region "${AWS_REGION}" \
  --query 'Stacks[0].Outputs[?OutputKey==`workflowsServiceUrl`].OutputValue' \
  --output text 2>/dev/null || echo "Not deployed yet")

SERVICE_NAMESPACE=$(aws cloudformation describe-stacks \
  --stack-name "McpMicroservicesStack-${STAGE}" \
  --region "${AWS_REGION}" \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceDiscoveryNamespace`].OutputValue' \
  --output text 2>/dev/null || echo "Not deployed yet")

cd ../..

# Health checks for all services
if [[ "$MAIN_URL" != "Not deployed yet" ]]; then
    echo -e "${YELLOW}🔍 Performing health checks...${NC}"
    sleep 60  # Wait for services to be ready
    
    # Check API Gateway health
    echo -e "${CYAN}Checking API Gateway health...${NC}"
    for i in {1..5}; do
        if curl -f "${GATEWAY_URL}/api/v1/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ API Gateway health check passed!${NC}"
            break
        fi
        if [ $i -eq 5 ]; then
            echo -e "${YELLOW}⚠️  API Gateway health check failed${NC}"
        else
            sleep 30
        fi
    done
    
    # Check individual service health through load balancer
    echo -e "${CYAN}Checking service health through load balancer...${NC}"
    
    # Check agents service
    for i in {1..3}; do
        if curl -f "${AGENTS_URL}/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Agents service health check passed!${NC}"
            break
        fi
        if [ $i -eq 3 ]; then
            echo -e "${YELLOW}⚠️  Agents service health check failed${NC}"
        else
            sleep 20
        fi
    done
    
    # Check tools service
    for i in {1..3}; do
        if curl -f "${TOOLS_URL}/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Tools service health check passed!${NC}"
            break
        fi
        if [ $i -eq 3 ]; then
            echo -e "${YELLOW}⚠️  Tools service health check failed${NC}"
        else
            sleep 20
        fi
    done
    
    # Check workflows service
    for i in {1..3}; do
        if curl -f "${WORKFLOWS_URL}/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Workflows service health check passed!${NC}"
            break
        fi
        if [ $i -eq 3 ]; then
            echo -e "${YELLOW}⚠️  Workflows service health check failed${NC}"
        else
            sleep 20
        fi
    done
fi

echo -e "${GREEN}✅ Microservices deployment completed successfully!${NC}"
echo -e "${BLUE}===============================================${NC}"
echo -e "${GREEN}🌐 Main Load Balancer: ${MAIN_URL}${NC}"
echo -e "${GREEN}🚪 API Gateway: ${GATEWAY_URL}${NC}"
echo -e "${GREEN}🔧 MCP Endpoint: ${GATEWAY_URL}/mcp${NC}"
echo -e "${GREEN}📚 API Documentation: ${GATEWAY_URL}/api/docs${NC}"
echo -e "${GREEN}💗 Gateway Health Check: ${GATEWAY_URL}/api/v1/health${NC}"
echo -e "${BLUE}===============================================${NC}"
echo -e "${CYAN}Service Endpoints:${NC}"
echo -e "${GREEN}🤖 Agents Service: ${AGENTS_URL}${NC}"
echo -e "${GREEN}🔧 Tools Service: ${TOOLS_URL}${NC}"
echo -e "${GREEN}⚡ Workflows Service: ${WORKFLOWS_URL}${NC}"
echo -e "${BLUE}===============================================${NC}"
echo -e "${CYAN}Infrastructure:${NC}"
echo -e "${GREEN}🔍 Service Discovery: ${SERVICE_NAMESPACE}${NC}"
echo -e "${BLUE}===============================================${NC}"

# Save deployment info
cat > deployment-info-microservices-${STAGE}.json << EOF
{
  "stage": "${STAGE}",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "region": "${AWS_REGION}",
  "accountId": "${AWS_ACCOUNT_ID}",
  "architecture": "microservices",
  "services": {
    "mainUrl": "${MAIN_URL}",
    "gateway": "${GATEWAY_URL}",
    "agents": "${AGENTS_URL}",
    "tools": "${TOOLS_URL}",
    "workflows": "${WORKFLOWS_URL}"
  },
  "serviceDiscovery": "${SERVICE_NAMESPACE}",
  "imageTag": "${IMAGE_TAG}"
}
EOF

echo -e "${GREEN}📄 Deployment info saved to deployment-info-microservices-${STAGE}.json${NC}"

# Display service monitoring commands
echo -e "${BLUE}===============================================${NC}"
echo -e "${CYAN}Monitoring Commands:${NC}"
echo -e "${YELLOW}# View ECS services${NC}"
echo -e "aws ecs list-services --cluster mcp-hybrid-${STAGE}"
echo -e ""
echo -e "${YELLOW}# View service tasks${NC}"
echo -e "aws ecs list-tasks --cluster mcp-hybrid-${STAGE}"
echo -e ""
echo -e "${YELLOW}# View service logs${NC}"
echo -e "aws logs describe-log-groups --log-group-name-prefix '/ecs/mcp-hybrid-${STAGE}'"
echo -e ""
echo -e "${YELLOW}# Scale specific service${NC}"
echo -e "aws ecs update-service --cluster mcp-hybrid-${STAGE} --service mcp-agents-${STAGE} --desired-count 3"
echo -e "${BLUE}===============================================${NC}"