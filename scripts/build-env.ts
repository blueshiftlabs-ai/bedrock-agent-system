#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import {
  SSMClient,
  GetParameterCommand,
  GetParametersByPathCommand,
  Parameter,
} from '@aws-sdk/client-ssm';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { config, AppConfig, PackageConfig } from './env-config';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

interface EnvConfig {
  apps: Record<string, AppConfig>;
  packages: Record<string, PackageConfig>;
  infrastructure: Record<string, AppConfig>;
  environments: string[];
  parameterPrefix: string;
  secretPrefix: string;
}

interface FetchedParameters {
  [key: string]: string;
}

class BuildEnvManager {
  private ssmClient: SSMClient;
  private secretsClient: SecretsManagerClient;
  private environment: string;
  private region: string;
  private fetchedParameters: FetchedParameters = {};
  private fetchedSecrets: FetchedParameters = {};

  constructor(environment: string, region: string = 'us-east-1') {
    this.environment = environment;
    this.region = region;
    this.ssmClient = new SSMClient({ region });
    this.secretsClient = new SecretsManagerClient({ region });
  }

  async build() {
    console.log(`🚀 Building environment files for: ${this.environment}`);
    console.log(`📍 AWS Region: ${this.region}`);

    try {
      // Try to fetch parameters and secrets, but continue with defaults if it fails
      if (this.environment !== 'local') {
        await this.fetchAllParameters();
        await this.fetchAllSecrets();
      } else {
        console.log('⚠️  Running in local mode - using default values');
      }

      // Generate .env files for each app and package
      await this.generateEnvFiles();

      // Generate .env.example files
      await this.generateExampleFiles();

      console.log('✅ Environment files generated successfully!');
    } catch (error: any) {
      console.error('❌ Error building environment files:', error);
      process.exit(1);
    }
  }

  private async fetchAllParameters() {
    console.log('📥 Fetching parameters from AWS Parameter Store...');

    const parameterPath = `${config.parameterPrefix}/${this.environment}`;
    const parameters: Parameter[] = [];
    let nextToken: string | undefined;

    do {
      try {
        const response = await this.ssmClient.send(
          new GetParametersByPathCommand({
            Path: parameterPath,
            Recursive: true,
            WithDecryption: true,
            NextToken: nextToken,
          })
        );

        if (response.Parameters) {
          parameters.push(...response.Parameters);
        }

        nextToken = response.NextToken;
      } catch (error: any) {
        console.warn(`⚠️  Warning: Could not fetch parameters from ${parameterPath}`);
        console.warn(`   Using default/dummy values instead`);
        // Don't throw error, just use defaults
        break;
      }
    } while (nextToken);

    // Store parameters in a normalized format
    parameters.forEach((param) => {
      if (param.Name && param.Value) {
        const key = param.Name.replace(`${parameterPath}/`, '').replace(/\//g, '_');
        this.fetchedParameters[key] = param.Value;
      }
    });

    console.log(`✅ Fetched ${Object.keys(this.fetchedParameters).length} parameters`);
  }

  private async fetchAllSecrets() {
    console.log('🔐 Fetching secrets from AWS Secrets Manager...');

    // Collect all unique secrets needed
    const allSecrets = new Set<string>();
    
    Object.values(config.apps).forEach((appConfig) => {
      appConfig.secrets?.forEach((secret: string) => allSecrets.add(secret));
    });
    
    Object.values(config.packages).forEach((pkgConfig) => {
      pkgConfig.secrets?.forEach((secret: string) => allSecrets.add(secret));
    });

    // Fetch each secret
    for (const secretName of Array.from(allSecrets)) {
      try {
        const secretId = `${config.secretPrefix}/${this.environment}/${secretName}`;
        const response = await this.secretsClient.send(
          new GetSecretValueCommand({ SecretId: secretId })
        );

        if (response.SecretString) {
          try {
            // Try to parse as JSON first
            const secretData = JSON.parse(response.SecretString);
            Object.entries(secretData).forEach(([key, value]) => {
              this.fetchedSecrets[`${secretName}_${key}`] = String(value);
            });
          } catch {
            // If not JSON, store as plain string
            this.fetchedSecrets[secretName] = response.SecretString;
          }
        }
      } catch (error: any) {
        console.warn(`⚠️  Warning: Could not fetch secret ${secretName}`);
        console.warn(`   Using default/dummy value instead`);
        // Set a dummy value for the secret
        this.fetchedSecrets[secretName] = `DUMMY_SECRET_${secretName.toUpperCase()}`;
      }
    }

    console.log(`✅ Fetched ${Object.keys(this.fetchedSecrets).length} secrets`);
  }

  private async generateEnvFiles() {
    console.log('📝 Generating .env files...');

    // Generate for apps
    for (const [appName, appConfig] of Object.entries(config.apps)) {
      await this.generateEnvFile('apps', appName, appConfig);
    }

    // Generate for packages
    for (const [pkgName, pkgConfig] of Object.entries(config.packages)) {
      await this.generateEnvFile('packages', pkgName, pkgConfig);
    }
  }

  private async generateEnvFile(type: 'apps' | 'packages', name: string, config: AppConfig | PackageConfig) {
    const envPath = path.join(process.cwd(), type, name);
    const envFile = path.join(envPath, '.env');
    
    // Ensure directory exists
    if (!fs.existsSync(envPath)) {
      console.warn(`⚠️  Warning: Directory not found: ${envPath}`);
      return;
    }

    const envContent: string[] = [
      `# Generated by build-env script`,
      `# Environment: ${this.environment}`,
      `# Generated at: ${new Date().toISOString()}`,
      '',
    ];

    // Add NODE_ENV
    envContent.push(`NODE_ENV=${this.environment === 'prod' ? 'production' : this.environment}`);
    envContent.push('');

    // Add parameters
    if (config.parameters.length > 0) {
      envContent.push('# Parameters from AWS Parameter Store');
      for (const param of config.parameters) {
        const value = this.fetchedParameters[param] || 
                     config.fallback?.[param] || 
                     `DUMMY_${param.toUpperCase()}`;
        
        // Don't throw error for missing required params - use dummy value
        if (!value && config.required?.includes(param)) {
          console.warn(`⚠️  Warning: Required parameter '${param}' not found for ${type}/${name}, using dummy value`);
        }
        
        if (value) {
          envContent.push(`${param}=${value}`);
        }
      }
      envContent.push('');
    }

    // Add secrets
    if (config.secrets && config.secrets.length > 0) {
      envContent.push('# Secrets from AWS Secrets Manager');
      for (const secret of config.secrets) {
        const value = this.fetchedSecrets[secret] || 
                     config.fallback?.[secret] || 
                     `DUMMY_SECRET_${secret.toUpperCase()}`;
        
        // Don't throw error for missing required secrets - use dummy value
        if (!value && config.required?.includes(secret)) {
          console.warn(`⚠️  Warning: Required secret '${secret}' not found for ${type}/${name}, using dummy value`);
        }
        
        if (value) {
          envContent.push(`${secret}=${value}`);
        }
      }
      envContent.push('');
    }

    await writeFile(envFile, envContent.join('\n'));
    console.log(`✅ Generated: ${envFile}`);
  }

  private async generateExampleFiles() {
    console.log('📄 Generating .env.example files...');

    // Generate for apps
    for (const [appName, appConfig] of Object.entries(config.apps)) {
      await this.generateExampleFile('apps', appName, appConfig);
    }

    // Generate for packages
    for (const [pkgName, pkgConfig] of Object.entries(config.packages)) {
      await this.generateExampleFile('packages', pkgName, pkgConfig);
    }
  }

  private async generateExampleFile(type: 'apps' | 'packages', name: string, config: AppConfig | PackageConfig) {
    const envPath = path.join(process.cwd(), type, name);
    const exampleFile = path.join(envPath, '.env.example');
    
    if (!fs.existsSync(envPath)) {
      return;
    }

    const exampleContent: string[] = [
      `# Environment configuration example for ${name}`,
      `# Copy this file to .env and fill in the values`,
      '',
      'NODE_ENV=development',
      '',
    ];

    // Add parameters
    if (config.parameters.length > 0) {
      exampleContent.push('# Parameters');
      for (const param of config.parameters) {
        const isRequired = config.required?.includes(param) ? ' (required)' : '';
        const fallback = config.fallback?.[param] ? ` # default: ${config.fallback[param]}` : '';
        exampleContent.push(`${param}=your_value_here${isRequired}${fallback}`);
      }
      exampleContent.push('');
    }

    // Add secrets
    if (config.secrets && config.secrets.length > 0) {
      exampleContent.push('# Secrets');
      for (const secret of config.secrets) {
        const isRequired = config.required?.includes(secret) ? ' (required)' : '';
        exampleContent.push(`${secret}=your_secret_here${isRequired}`);
      }
      exampleContent.push('');
    }

    await writeFile(exampleFile, exampleContent.join('\n'));
    console.log(`✅ Generated: ${exampleFile}`);
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const environment = args[0] || process.env.NODE_ENV || 'local';
  const region = args[1] || process.env.AWS_REGION || 'us-east-1';

  if (!config.environments.includes(environment)) {
    console.error(`❌ Invalid environment: ${environment}`);
    console.error(`   Valid environments: ${config.environments.join(', ')}`);
    process.exit(1);
  }

  const manager = new BuildEnvManager(environment, region);
  await manager.build();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { BuildEnvManager };