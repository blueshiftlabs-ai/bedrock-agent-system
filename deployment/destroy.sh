#!/bin/bash

set -e

STAGE=${1:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}

echo "🗑️  Destroying MCP Hybrid Server infrastructure for stage: $STAGE"
echo "⚠️  This will permanently delete all resources!"

read -p "Are you sure you want to continue? (yes/no): " confirmation
if [[ $confirmation != "yes" ]]; then
    echo "❌ Aborted"
    exit 1
fi

cd infrastructure/mcp-hybrid-stack
cdk destroy McpHybridStack-${STAGE} --force
cd ../..

echo "✅ Infrastructure destroyed for stage: $STAGE"
