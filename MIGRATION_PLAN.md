# Repository Migration Plan

## Apps to Keep (Core Production Apps)
- ✅ `apps/mcp-memory-server` - Production MCP memory backend
- ✅ `apps/mcp-memory-server-dashboard` - Production dashboard UI

## Apps to Move to ~/projects/mcp-memory-server-continuation
- 🚀 `apps/mcp-hybrid-server` - Legacy backend implementation
- 🚀 `apps/mcp-dashboard` - Legacy dashboard
- 🚀 `apps/mcp-memory-orchestrator` - Experimental orchestrator
- 🚀 `apps/mcp-opensearch-wrapper` - OpenSearch wrapper service

## Packages to Move
- 🚀 `packages/aws-api` - AWS-specific utilities
- 🚀 `packages/mcp-cli` - CLI tools
- 🚀 `packages/mcp-core` - Core MCP utilities
- 🚀 `packages/shared-types` - Shared TypeScript types

## Packages to Keep
- ✅ `packages/eslint-config` - Shared linting configuration
- ✅ `packages/prettier-config` - Shared formatting configuration
- ✅ `packages/typescript-config` - Shared TypeScript configuration

## Other Items to Move
- 🚀 `infrastructure/` - CDK stack (if exists)
- 🚀 `deployment/` - Legacy deployment scripts
- 🚀 Legacy Docker configurations

## Migration Steps
1. Create backup of current state
2. Move legacy apps to continuation directory
3. Update root package.json and pnpm-workspace.yaml
4. Update .gitignore if needed
5. Test core apps still function
6. Update README to reflect new structure
7. Commit changes