# Build Environment Script

This script manages environment configuration for all apps and packages in the Bedrock Agent System monorepo.

## Features

- **Centralized Configuration**: Single source of truth for all environment variables
- **AWS Integration**: Fetches parameters from AWS Parameter Store and Secrets Manager
- **Multi-Environment Support**: Supports local, dev, staging, and prod environments
- **Validation**: Ensures all required parameters are present
- **Auto-Generation**: Creates .env and .env.example files automatically
- **Local Development**: Supports fallback values for local development
- **Pre-Build Integration**: Automatically runs before build process

## Usage

### Build environment files for current environment
```bash
pnpm build:env
```

### Build for specific environments
```bash
pnpm build:env:local    # Local development (uses fallback values)
pnpm build:env:dev      # Development environment
pnpm build:env:staging  # Staging environment
pnpm build:env:prod     # Production environment
```

### Manual execution with custom region
```bash
ts-node scripts/build-env.ts <environment> <aws-region>
```

## Configuration

Edit `scripts/env-config.ts` to:
- Add new apps or packages
- Define required parameters and secrets
- Set fallback values for local development
- Mark parameters as required for validation

## AWS Setup

### Parameter Store Structure
```
/bedrock-agent-system/
  /dev/
    /AWS_REGION
    /DYNAMODB_TABLE_PREFIX
    /S3_BUCKET_NAME
    ...
  /staging/
    ...
  /prod/
    ...
```

### Secrets Manager Structure
```
bedrock-agent-system/dev/API_KEY
bedrock-agent-system/dev/JWT_SECRET
bedrock-agent-system/staging/API_KEY
...
```

## Environment Files Generated

For each app/package, the script generates:
- `.env` - Actual environment file with values
- `.env.example` - Example file for documentation

## Integration with Build Process

The script runs automatically before builds via the `prebuild` npm script hook.

## Adding New Apps/Packages

1. Edit `scripts/env-config.ts`
2. Add configuration under `apps` or `packages`:
```typescript
'my-new-app': {
  parameters: ['PARAM1', 'PARAM2'],
  secrets: ['SECRET1'],
  required: ['PARAM1'],
  fallback: {
    PARAM2: 'default-value'
  }
}
```

3. Run `pnpm build:env` to generate files

## Security Notes

- Never commit `.env` files to version control
- Use AWS IAM roles for production deployments
- Rotate secrets regularly
- Use separate AWS accounts for different environments when possible