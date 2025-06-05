import { Injectable, Logger } from '@nestjs/common';
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

export interface SecretsConfig {
  [key: string]: any;
}

@Injectable()
export class SecretsManagerLoader {
  private readonly logger = new Logger(SecretsManagerLoader.name);
  private readonly secretsManager: SecretsManager;
  private readonly cache: Map<string, any> = new Map();
  private readonly prefix: string;

  constructor() {
    this.secretsManager = new SecretsManager({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.prefix = `/mcp-hybrid/${process.env.STAGE || 'dev'}`;
  }

  /**
   * Load all secrets for the application
   */
  async loadSecrets(): Promise<SecretsConfig> {
    try {
      this.logger.log(`Loading secrets with prefix: ${this.prefix}`);
      
      const secretNames = await this.listSecrets();
      const config: SecretsConfig = {};

      for (const secretName of secretNames) {
        const secret = await this.getSecret(secretName);
        if (secret) {
          const key = this.secretNameToEnvKey(secretName);
          config[key] = secret;
        }
      }

      this.logger.log(`Loaded ${Object.keys(config).length} secrets from Secrets Manager`);
      return config;
    } catch (error: any) {
      this.logger.error('Failed to load secrets from Secrets Manager', error);
      return {};
    }
  }

  /**
   * Get a single secret
   */
  async getSecret(name: string, useCache = true): Promise<any> {
    const fullName = name.startsWith('/') ? name : `${this.prefix}/${name}`;

    if (useCache && this.cache.has(fullName)) {
      return this.cache.get(fullName);
    }

    try {
      const response = await this.secretsManager.getSecretValue({
        SecretId: fullName,
      });

      let value: any;
      if (response.SecretString) {
        try {
          value = JSON.parse(response.SecretString);
        } catch {
          value = response.SecretString;
        }
      } else if (response.SecretBinary) {
        value = Buffer.from(response.SecretBinary as string, 'base64').toString();
      }

      if (value !== undefined) {
        this.cache.set(fullName, value);
      }
      return value;
    } catch (error: any) {
      if (error.name !== 'ResourceNotFoundException') {
        this.logger.error(`Failed to get secret: ${fullName}`, error);
      }
      return undefined;
    }
  }

  /**
   * List all secrets with the configured prefix
   */
  private async listSecrets(): Promise<string[]> {
    const secretNames: string[] = [];
    let nextToken: string | undefined;

    try {
      do {
        const response = await this.secretsManager.listSecrets({
          NextToken: nextToken,
          MaxResults: 100,
        });

        if (response.SecretList) {
          const filteredSecrets = response.SecretList
            .filter(secret => secret.Name?.startsWith(this.prefix))
            .map(secret => secret.Name!)
            .filter(Boolean);
          
          secretNames.push(...filteredSecrets);
        }

        nextToken = response.NextToken;
      } while (nextToken);

      return secretNames;
    } catch (error: any) {
      this.logger.error('Failed to list secrets', error);
      return [];
    }
  }

  /**
   * Convert secret name to environment variable key
   */
  private secretNameToEnvKey(secretName: string): string {
    // Remove prefix and convert to uppercase with underscores
    const relativePath = secretName.replace(this.prefix + '/', '');
    return relativePath
      .toUpperCase()
      .replace(/[/-]/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}