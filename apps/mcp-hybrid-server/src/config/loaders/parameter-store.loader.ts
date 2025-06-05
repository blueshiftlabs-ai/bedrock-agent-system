import { Injectable, Logger } from '@nestjs/common';
import { GetParametersByPathCommandOutput, Parameter, SSM } from '@aws-sdk/client-ssm';

export interface ParameterStoreConfig {
  [key: string]: string | undefined;
}

@Injectable()
export class ParameterStoreLoader {
  private readonly logger = new Logger(ParameterStoreLoader.name);
  private readonly ssm: SSM;
  private readonly cache: Map<string, string> = new Map();
  private readonly prefix: string;

  constructor() {
    this.ssm = new SSM({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.prefix = process.env.PARAMETER_STORE_PREFIX || `/mcp-hybrid/${process.env.STAGE || 'dev'}`;
  }

  /**
   * Load all parameters for the application
   */
  async loadParameters(): Promise<ParameterStoreConfig> {
    try {
      this.logger.log(`Loading parameters from prefix: ${this.prefix}`);
      
      const parameters = await this.getParametersByPath(this.prefix);
      const config: ParameterStoreConfig = {};

      for (const param of parameters) {
        if (param.Name && param.Value) {
          const key = this.parameterNameToEnvKey(param.Name);
          config[key] = param.Value;
          this.cache.set(param.Name, param.Value);
        }
      }

      this.logger.log(`Loaded ${Object.keys(config).length} parameters from Parameter Store`);
      return config;
    } catch (error: any) {
      this.logger.error('Failed to load parameters from Parameter Store', error);
      return {};
    }
  }

  /**
   * Get a single parameter
   */
  async getParameter(name: string, useCache = true): Promise<string | undefined> {
    const fullName = name.startsWith('/') ? name : `${this.prefix}/${name}`;

    if (useCache && this.cache.has(fullName)) {
      return this.cache.get(fullName);
    }

    try {
      const response = await this.ssm.getParameter({
        Name: fullName,
        WithDecryption: true,
      });

      const value = response.Parameter?.Value;
      if (value) {
        this.cache.set(fullName, value);
      }
      return value;
    } catch (error: any) {
      this.logger.error(`Failed to get parameter: ${fullName}`, error);
      return undefined;
    }
  }

  /**
   * Get multiple parameters
   */
  async getParameters(names: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const fullNames = names.map(name => 
      name.startsWith('/') ? name : `${this.prefix}/${name}`
    );

    try {
      // AWS SSM has a limit of 10 parameters per request
      const chunks = this.chunkArray(fullNames, 10);

      for (const chunk of chunks) {
        const response = await this.ssm.getParameters({
          Names: chunk,
          WithDecryption: true,
        });

        if (response.Parameters) {
          for (const param of response.Parameters) {
            if (param.Name && param.Value) {
              result.set(param.Name, param.Value);
              this.cache.set(param.Name, param.Value);
            }
          }
        }
      }

      return result;
    } catch (error: any) {
      this.logger.error('Failed to get parameters', error);
      return result;
    }
  }

  /**
   * Get all parameters by path
   */
  private async getParametersByPath(path: string): Promise<Parameter[]> {
    const parameters: Parameter[] = [];
    let nextToken: string | undefined;

    try {
      do {
        const response: GetParametersByPathCommandOutput = await this.ssm.getParametersByPath({
          Path: path,
          Recursive: true,
          WithDecryption: true,
          NextToken: nextToken,
        });

        if (response.Parameters) {
          parameters.push(...response.Parameters);
        }

        nextToken = response.NextToken;
      } while (nextToken);

      return parameters;
    } catch (error: any) {
      this.logger.error(`Failed to get parameters by path: ${path}`, error);
      return [];
    }
  }

  /**
   * Convert parameter name to environment variable key
   */
  private parameterNameToEnvKey(parameterName: string): string {
    // Remove prefix and convert to uppercase with underscores
    const relativePath = parameterName.replace(this.prefix + '/', '');
    return relativePath
      .toUpperCase()
      .replace(/[/-]/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
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

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}