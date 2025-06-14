#!/bin/bash

# Repository Migration Script
# Moves legacy apps to separate directory while keeping core MCP Memory Server apps

set -e

echo "🚀 Starting repository migration..."

TARGET_DIR="$HOME/projects/mcp-memory-server-continuation"
SOURCE_DIR="$(pwd)"

# Create target directory structure
echo "📁 Creating target directory structure..."
mkdir -p "$TARGET_DIR/apps"
mkdir -p "$TARGET_DIR/packages"
mkdir -p "$TARGET_DIR/infrastructure"
mkdir -p "$TARGET_DIR/deployment"

# Move legacy apps
echo "📦 Moving legacy apps..."
mv apps/mcp-hybrid-server "$TARGET_DIR/apps/" 2>/dev/null || echo "  - mcp-hybrid-server already moved or doesn't exist"
mv apps/mcp-dashboard "$TARGET_DIR/apps/" 2>/dev/null || echo "  - mcp-dashboard already moved or doesn't exist"
mv apps/mcp-memory-orchestrator "$TARGET_DIR/apps/" 2>/dev/null || echo "  - mcp-memory-orchestrator already moved or doesn't exist"
mv apps/mcp-opensearch-wrapper "$TARGET_DIR/apps/" 2>/dev/null || echo "  - mcp-opensearch-wrapper already moved or doesn't exist"

# Move legacy packages
echo "📦 Moving legacy packages..."
mv packages/aws-api "$TARGET_DIR/packages/" 2>/dev/null || echo "  - aws-api already moved or doesn't exist"
mv packages/mcp-cli "$TARGET_DIR/packages/" 2>/dev/null || echo "  - mcp-cli already moved or doesn't exist"
mv packages/mcp-core "$TARGET_DIR/packages/" 2>/dev/null || echo "  - mcp-core already moved or doesn't exist"
mv packages/shared-types "$TARGET_DIR/packages/" 2>/dev/null || echo "  - shared-types already moved or doesn't exist"

# Move infrastructure and deployment
echo "📦 Moving infrastructure and deployment..."
mv infrastructure/* "$TARGET_DIR/infrastructure/" 2>/dev/null || echo "  - infrastructure already moved or doesn't exist"
mv deployment/* "$TARGET_DIR/deployment/" 2>/dev/null || echo "  - deployment already moved or doesn't exist"

# Copy essential files to continuation project
echo "📋 Copying essential files to continuation project..."
cp -n package.json "$TARGET_DIR/" 2>/dev/null || echo "  - package.json already exists"
cp -n pnpm-workspace.yaml "$TARGET_DIR/" 2>/dev/null || echo "  - pnpm-workspace.yaml already exists"
cp -n .npmrc "$TARGET_DIR/" 2>/dev/null || true
cp -n turbo.json "$TARGET_DIR/" 2>/dev/null || true

# Create a README for the continuation project
cat > "$TARGET_DIR/README.md" << 'EOF'
# MCP Memory Server - Legacy Components

This repository contains the legacy components moved from the main MCP Memory Server project.

## Contents

### Legacy Apps
- `mcp-hybrid-server` - Original hybrid MCP server implementation
- `mcp-dashboard` - Original dashboard implementation
- `mcp-memory-orchestrator` - Experimental orchestrator service
- `mcp-opensearch-wrapper` - OpenSearch wrapper service

### Legacy Packages
- `aws-api` - AWS-specific API utilities
- `mcp-cli` - Command-line interface tools
- `mcp-core` - Core MCP protocol utilities
- `shared-types` - Shared TypeScript type definitions

### Infrastructure
- `mcp-hybrid-stack` - AWS CDK infrastructure definitions

### Deployment
- Legacy deployment scripts

## Note
These components have been moved to preserve history while the main repository focuses on the production-ready MCP Memory Server and Dashboard applications.

For the production applications, see: https://github.com/blueshiftlabs-ai/bedrock-agent-system
EOF

echo "✅ Migration complete!"
echo ""
echo "📍 Legacy components moved to: $TARGET_DIR"
echo "📍 Core apps remaining: mcp-memory-server, mcp-memory-server-dashboard"
echo ""
echo "Next steps:"
echo "1. Update pnpm-workspace.yaml to remove moved packages"
echo "2. Update root package.json dependencies"
echo "3. Test that core apps still build and run"
echo "4. Update main README.md"
echo "5. Commit changes"