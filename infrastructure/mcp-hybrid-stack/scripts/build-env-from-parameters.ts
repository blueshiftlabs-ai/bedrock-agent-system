#!/usr/bin/env node

import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';

interface ParameterManifest {
  stage: string;
  prefix: string;
  region: string;
  account: string;
  parameters: { [key: string]: string };
  secrets: { [key: string]: string };
  timestamp: string;
}

interface EnvVariable {
  name: string;
  value: string;
  source: 'parameter' | 'secret';
}

class ParameterStoreEnvBuilder {
  private ssm: AWS.SSM;
  private secretsManager: AWS.SecretsManager;
  private manifest: ParameterManifest;

  constructor(region: string, manifestPath: string) {
    AWS.config.update({ region });
    this.ssm = new AWS.SSM();
    this.secretsManager = new AWS.SecretsManager();
    this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  /**
   * Retrieve all parameters from Parameter Store
   */
  private async getParameters(): Promise<Map<string, string>> {
    const parameterMap = new Map<string, string>();
    const parameterNames = Object.values(this.manifest.parameters);

    // AWS SSM has a limit of 10 parameters per request
    const chunks = this.chunkArray(parameterNames, 10);

    for (const chunk of chunks) {
      try {
        const response = await this.ssm.getParameters({
          Names: chunk,
          WithDecryption: true,
        }).promise();

        if (response.Parameters) {
          response.Parameters.forEach(param => {
            if (param.Name && param.Value) {
              parameterMap.set(param.Name, param.Value);
            }
          });
        }

        if (response.InvalidParameters && response.InvalidParameters.length > 0) {
          console.warn('Invalid parameters:', response.InvalidParameters);
        }
      } catch (error: any) {
        console.error('Error retrieving parameters:', error);
      }
    }

    return parameterMap;
  }

  /**
   * Retrieve all secrets from Secrets Manager
   */
  private async getSecrets(): Promise<Map<string, any>> {
    const secretMap = new Map<string, any>();
    const secretNames = Object.values(this.manifest.secrets);

    for (const secretName of secretNames) {
      try {
        const response = await this.secretsManager.getSecretValue({
          SecretId: secretName,
        }).promise();

        if (response.SecretString) {
          const secretValue = JSON.parse(response.SecretString);
          secretMap.set(secretName, secretValue);
        }
      } catch (error: any) {
        console.error(`Error retrieving secret ${secretName}:`, error);
      }
    }

    return secretMap;
  }

  /**
   * Convert parameter path to environment variable name
   */
  private pathToEnvName(path: string): string {
    // Remove prefix and convert to uppercase with underscores
    const relativePath = path.replace(this.manifest.prefix + '/' + this.manifest.stage + '/', '');
    return relativePath
      .toUpperCase()
      .replace(/[/-]/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
  }

  /**
   * Build environment variables from parameters and secrets
   */
  public async buildEnvVariables(): Promise<EnvVariable[]> {
    const envVariables: EnvVariable[] = [];

    // Get parameters
    const parameters = await this.getParameters();
    for (const [logicalPath, parameterName] of Object.entries(this.manifest.parameters)) {
      const value = parameters.get(parameterName);
      if (value) {
        envVariables.push({
          name: this.pathToEnvName(parameterName),
          value,
          source: 'parameter',
        });
      }
    }

    // Get secrets
    const secrets = await this.getSecrets();
    for (const [logicalName, secretName] of Object.entries(this.manifest.secrets)) {
      const secretValue = secrets.get(secretName);
      if (secretValue) {
        // For complex secrets, we might want to flatten them
        if (typeof secretValue === 'object') {
          for (const [key, value] of Object.entries(secretValue)) {
            envVariables.push({
              name: `${this.pathToEnvName(secretName)}_${key.toUpperCase()}`,
              value: String(value),
              source: 'secret',
            });
          }
        } else {
          envVariables.push({
            name: this.pathToEnvName(secretName),
            value: String(secretValue),
            source: 'secret',
          });
        }
      }
    }

    return envVariables;
  }

  /**
   * Generate .env file
   */
  public async generateEnvFile(outputPath: string): Promise<void> {
    const envVariables = await this.buildEnvVariables();
    
    const envContent = [
      '# Generated from AWS Parameter Store and Secrets Manager',
      `# Stage: ${this.manifest.stage}`,
      `# Generated at: ${new Date().toISOString()}`,
      '',
      '# Parameters from Parameter Store',
      ...envVariables
        .filter(v => v.source === 'parameter')
        .map(v => `${v.name}=${v.value}`),
      '',
      '# Secrets from Secrets Manager',
      ...envVariables
        .filter(v => v.source === 'secret')
        .map(v => `${v.name}=${v.value}`),
    ].join('\n');

    fs.writeFileSync(outputPath, envContent);
    console.log(`Environment file written to: ${outputPath}`);
  }

  /**
   * Generate shell export script
   */
  public async generateExportScript(outputPath: string): Promise<void> {
    const envVariables = await this.buildEnvVariables();
    
    const scriptContent = [
      '#!/bin/bash',
      '# Generated from AWS Parameter Store and Secrets Manager',
      `# Stage: ${this.manifest.stage}`,
      `# Generated at: ${new Date().toISOString()}`,
      '',
      '# Export all environment variables',
      ...envVariables.map(v => `export ${v.name}="${v.value}"`),
    ].join('\n');

    fs.writeFileSync(outputPath, scriptContent);
    fs.chmodSync(outputPath, '755');
    console.log(`Export script written to: ${outputPath}`);
  }

  /**
   * Generate Docker env file
   */
  public async generateDockerEnvFile(outputPath: string): Promise<void> {
    const envVariables = await this.buildEnvVariables();
    
    const envContent = envVariables
      .map(v => `${v.name}=${v.value}`)
      .join('\n');

    fs.writeFileSync(outputPath, envContent);
    console.log(`Docker env file written to: ${outputPath}`);
  }

  /**
   * Helper to chunk array
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// CLI
const program = new Command();

program
  .name('build-env-from-parameters')
  .description('Build environment files from AWS Parameter Store and Secrets Manager')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate environment files from parameter manifest')
  .requiredOption('-m, --manifest <path>', 'Path to parameter manifest JSON file')
  .requiredOption('-r, --region <region>', 'AWS region')
  .option('-o, --output <path>', 'Output directory', '.')
  .option('-f, --format <format>', 'Output format (env, export, docker, all)', 'all')
  .action(async (options) => {
    try {
      const builder = new ParameterStoreEnvBuilder(options.region, options.manifest);
      const outputDir = path.resolve(options.output);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const formats = options.format === 'all' 
        ? ['env', 'export', 'docker'] 
        : [options.format];

      for (const format of formats) {
        switch (format) {
          case 'env':
            await builder.generateEnvFile(path.join(outputDir, '.env'));
            break;
          case 'export':
            await builder.generateExportScript(path.join(outputDir, 'export-env.sh'));
            break;
          case 'docker':
            await builder.generateDockerEnvFile(path.join(outputDir, 'docker.env'));
            break;
        }
      }

      console.log('Environment files generated successfully!');
    } catch (error: any) {
      console.error('Error generating environment files:', error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate that all parameters in manifest exist')
  .requiredOption('-m, --manifest <path>', 'Path to parameter manifest JSON file')
  .requiredOption('-r, --region <region>', 'AWS region')
  .action(async (options) => {
    try {
      const manifest: ParameterManifest = JSON.parse(
        fs.readFileSync(options.manifest, 'utf-8')
      );

      console.log(`Validating parameters for stage: ${manifest.stage}`);
      console.log(`Parameter count: ${Object.keys(manifest.parameters).length}`);
      console.log(`Secret count: ${Object.keys(manifest.secrets).length}`);

      const builder = new ParameterStoreEnvBuilder(options.region, options.manifest);
      const envVariables = await builder.buildEnvVariables();

      console.log(`\nSuccessfully retrieved ${envVariables.length} environment variables`);
      console.log(`Parameters: ${envVariables.filter(v => v.source === 'parameter').length}`);
      console.log(`Secrets: ${envVariables.filter(v => v.source === 'secret').length}`);
    } catch (error: any) {
      console.error('Validation failed:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);