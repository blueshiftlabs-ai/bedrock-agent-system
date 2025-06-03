import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

export interface ParameterStoreEntry {
  path: string;
  value: string;
  description?: string;
  type?: 'String' | 'SecureString';
}

export interface SecretEntry {
  name: string;
  value?: string;
  description?: string;
  generateSecretString?: secretsmanager.SecretStringGenerator;
}

export interface ParameterStoreManagerProps {
  stage: string;
  prefix?: string;
}

export class ParameterStoreManager extends Construct {
  private readonly stage: string;
  private readonly prefix: string;
  private readonly parameters: Map<string, ssm.IStringParameter> = new Map();
  private readonly secrets: Map<string, secretsmanager.ISecret> = new Map();
  private readonly manifest: {
    parameters: { [key: string]: string };
    secrets: { [key: string]: string };
  } = { parameters: {}, secrets: {} };

  constructor(scope: Construct, id: string, props: ParameterStoreManagerProps) {
    super(scope, id);

    this.stage = props.stage;
    this.prefix = props.prefix || '/mcp-hybrid';
  }

  /**
   * Add a parameter to AWS Systems Manager Parameter Store
   */
  public addParameter(entry: ParameterStoreEntry): ssm.IStringParameter {
    const parameterPath = this.buildPath(entry.path);
    
    const parameter = new ssm.StringParameter(this, `Parameter-${entry.path.replace(/[^a-zA-Z0-9]/g, '-')}`, {
      parameterName: parameterPath,
      stringValue: entry.value,
      description: entry.description || `Parameter for ${entry.path}`,
      type: entry.type === 'SecureString' 
        ? ssm.ParameterType.SECURE_STRING 
        : ssm.ParameterType.STRING,
    });

    this.parameters.set(parameterPath, parameter);
    this.manifest.parameters[entry.path] = parameterPath;

    return parameter;
  }

  /**
   * Add multiple parameters
   */
  public addParameters(entries: ParameterStoreEntry[]): void {
    entries.forEach(entry => this.addParameter(entry));
  }

  /**
   * Add a secret to AWS Secrets Manager
   */
  public addSecret(entry: SecretEntry): secretsmanager.ISecret {
    const secretName = `${this.prefix}/${this.stage}/${entry.name}`;
    
    const secretProps: secretsmanager.SecretProps = {
      secretName,
      description: entry.description || `Secret for ${entry.name}`,
    };

    if (entry.value) {
      secretProps.secretStringValue = cdk.SecretValue.unsafePlainText(entry.value);
    } else if (entry.generateSecretString) {
      secretProps.generateSecretString = entry.generateSecretString;
    }

    const secret = new secretsmanager.Secret(this, `Secret-${entry.name.replace(/[^a-zA-Z0-9]/g, '-')}`, secretProps);

    this.secrets.set(secretName, secret);
    this.manifest.secrets[entry.name] = secretName;

    return secret;
  }

  /**
   * Add multiple secrets
   */
  public addSecrets(entries: SecretEntry[]): void {
    entries.forEach(entry => this.addSecret(entry));
  }

  /**
   * Build hierarchical parameter path
   */
  private buildPath(relativePath: string): string {
    return `${this.prefix}/${this.stage}/${relativePath}`;
  }

  /**
   * Get a parameter by path
   */
  public getParameter(path: string): ssm.IStringParameter | undefined {
    return this.parameters.get(this.buildPath(path));
  }

  /**
   * Get a secret by name
   */
  public getSecret(name: string): secretsmanager.ISecret | undefined {
    return this.secrets.get(`${this.prefix}/${this.stage}/${name}`);
  }

  /**
   * Grant read permissions for all parameters and secrets to a role
   */
  public grantRead(grantee: iam.IGrantable): void {
    // Grant read permissions for all parameters
    grantee.grantPrincipal.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
        resources: [
          `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter${this.prefix}/${this.stage}/*`
        ],
      })
    );

    // Grant read permissions for all secrets
    this.secrets.forEach(secret => {
      secret.grantRead(grantee);
    });
  }

  /**
   * Grant read permissions for specific parameters
   */
  public grantParameterRead(grantee: iam.IGrantable, paths: string[]): void {
    const resources = paths.map(path => 
      `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter${this.buildPath(path)}`
    );

    grantee.grantPrincipal.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources,
      })
    );
  }

  /**
   * Export manifest file for build scripts
   */
  public exportManifest(outputPath?: string): void {
    const manifestContent = {
      stage: this.stage,
      prefix: this.prefix,
      region: cdk.Stack.of(this).region,
      account: cdk.Stack.of(this).account,
      parameters: this.manifest.parameters,
      secrets: this.manifest.secrets,
      timestamp: new Date().toISOString(),
    };

    const filePath = outputPath || path.join(process.cwd(), `parameter-manifest-${this.stage}.json`);
    
    // Write manifest file
    fs.writeFileSync(filePath, JSON.stringify(manifestContent, null, 2));

    // Create CDK output for manifest location
    new cdk.CfnOutput(cdk.Stack.of(this), 'ParameterManifestPath', {
      value: filePath,
      description: 'Path to parameter manifest file',
    });
  }

  /**
   * Get all parameter paths
   */
  public getAllParameterPaths(): string[] {
    return Array.from(this.parameters.keys());
  }

  /**
   * Get all secret names
   */
  public getAllSecretNames(): string[] {
    return Array.from(this.secrets.keys());
  }

  /**
   * Create outputs for all parameters and secrets
   */
  public createOutputs(): void {
    // Output all parameter paths
    new cdk.CfnOutput(cdk.Stack.of(this), 'ParameterPaths', {
      value: JSON.stringify(this.getAllParameterPaths()),
      description: 'All parameter paths in Parameter Store',
    });

    // Output all secret ARNs
    new cdk.CfnOutput(cdk.Stack.of(this), 'SecretArns', {
      value: JSON.stringify(
        Array.from(this.secrets.entries()).map(([name, secret]) => ({
          name,
          arn: secret.secretArn,
        }))
      ),
      description: 'All secret ARNs in Secrets Manager',
    });
  }
}