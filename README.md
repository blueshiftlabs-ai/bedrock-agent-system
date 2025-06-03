# Bedrock Agent System

A monorepo containing the MCP Hybrid Server and related infrastructure for AI-powered microservice transformation and analysis.

## Structure

```
.
├── apps/                     # Application packages
│   └── mcp-hybrid-server/   # Main NestJS + LangGraph server
├── packages/                 # Shared packages
│   ├── eslint-config/       # Shared ESLint configurations
│   ├── typescript-config/   # Shared TypeScript configurations
│   └── prettier-config/     # Shared Prettier configurations
└── infrastructure/          # Infrastructure packages
    └── mcp-hybrid-stack/    # AWS CDK infrastructure
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- AWS CLI configured
- Docker (for local development)

### Installation

```bash
# Install dependencies
pnpm install

# Setup local development environment
pnpm --filter @apps/mcp-hybrid-server run setup-local-dev
```

### Development

```bash
# Run the application in development mode
pnpm app:dev

# Run all tests
pnpm test

# Run linting
pnpm lint

# Build all packages
pnpm build
```

### Infrastructure

```bash
# Synthesize CloudFormation templates
pnpm infrastructure:synth

# Deploy infrastructure
pnpm infrastructure:deploy

# Destroy infrastructure
pnpm infrastructure:destroy
```

## Workspace Commands

The monorepo uses pnpm workspaces and Turbo for efficient builds:

- `pnpm build` - Build all packages in dependency order
- `pnpm dev` - Run all packages in development mode
- `pnpm test` - Run tests across all packages
- `pnpm lint` - Lint all packages
- `pnpm format` - Format all packages
- `pnpm clean` - Clean build artifacts

## Package-Specific Commands

### MCP Hybrid Server

```bash
# Development
pnpm --filter @apps/mcp-hybrid-server dev

# Testing
pnpm --filter @apps/mcp-hybrid-server test
pnpm --filter @apps/mcp-hybrid-server test:e2e

# Docker
pnpm --filter @apps/mcp-hybrid-server docker:build
pnpm --filter @apps/mcp-hybrid-server docker:run

# Deployment
pnpm --filter @apps/mcp-hybrid-server deploy:dev
pnpm --filter @apps/mcp-hybrid-server deploy:prod
```

### Infrastructure

```bash
# CDK commands
pnpm --filter @infra/mcp-hybrid-stack synth
pnpm --filter @infra/mcp-hybrid-stack deploy
pnpm --filter @infra/mcp-hybrid-stack diff
```

## Configuration

### ESLint

Each package can extend the shared ESLint configuration:

```javascript
// eslint.config.mjs
import baseConfig from '@repo/eslint-config/nest';

export default [
  ...baseConfig,
  // Package-specific overrides
];
```

### TypeScript

Each package extends the appropriate TypeScript configuration:

```json
{
  "extends": "@repo/typescript-config/nest",
  "compilerOptions": {
    // Package-specific options
  }
}
```

### Prettier

Use the shared Prettier configuration in `.prettierrc.js`:

```javascript
module.exports = {
  ...require('@repo/prettier-config/prettier-base'),
};
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

MIT