import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

/**
 * Simplified AWS service using AWS SDK v3 directly
 * Provides basic AWS operations without circular dependencies
 * Will be enhanced with sophisticated memory layer in Phase 2
 */
@Injectable()
export class AwsService {
  private readonly logger = new Logger(AwsService.name);
  private readonly region: string;
  private readonly s3Client: S3Client;
  private readonly dynamoDbClient: DynamoDBClient;
  private readonly bedrockClient: BedrockRuntimeClient;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    
    // Initialize AWS clients with basic configuration
    const clientConfig = { region: this.region };
    this.s3Client = new S3Client(clientConfig);
    this.dynamoDbClient = new DynamoDBClient(clientConfig);
    this.bedrockClient = new BedrockRuntimeClient(clientConfig);
    
    this.logger.log(`AwsService initialized with region: ${this.region}`);
  }

  /**
   * Get AWS region from configuration
   */
  getRegion(): string {
    return this.region;
  }

  /**
   * Get AWS credentials configuration
   */
  getCredentialsConfig(): Record<string, any> {
    return {
      region: this.region,
    };
  }

  /**
   * Validate AWS service availability
   */
  async validateServiceAvailability(serviceName: string): Promise<boolean> {
    this.logger.log(`Validating ${serviceName} availability`);
    // Basic implementation - in production this would check service endpoints
    return true;
  }

  /**
   * Store data in S3 using AWS SDK v3
   */
  async storeInS3(
    bucket: string,
    key: string,
    data: string | Buffer,
    contentType?: string,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: contentType || 'application/octet-stream',
      });
      
      await this.s3Client.send(command);
      const s3Url = `s3://${bucket}/${key}`;
      this.logger.log(`Stored object at ${s3Url}`);
      return s3Url;
    } catch (error) {
      this.logger.error(`Failed to store object in S3: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Retrieve data from S3 using AWS SDK v3
   */
  async getFromS3(bucket: string, key: string): Promise<Buffer | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      
      const response = await this.s3Client.send(command);
      const body = response.Body;
      
      if (!body) {
        return null;
      }
      
      // Convert AWS SDK stream to buffer
      const chunks: Uint8Array[] = [];
      
      if (body instanceof ReadableStream) {
        const reader = body.getReader();
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
          }
        }
      } else {
        // Handle Node.js readable stream
        const stream = body as NodeJS.ReadableStream;
        return new Promise((resolve, reject) => {
          const chunks: Buffer[] = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', reject);
        });
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(`Failed to retrieve object from S3: ${error.message}`);
      return null;
    }
  }

  /**
   * Store memory metadata in DynamoDB
   */
  async storeMemoryMetadata(
    tableName: string,
    memoryId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      const command = new PutItemCommand({
        TableName: tableName,
        Item: {
          memoryId: { S: memoryId },
          ...this.convertToAttributeValue(metadata),
          createdAt: { S: new Date().toISOString() },
        },
      });
      
      await this.dynamoDbClient.send(command);
      this.logger.log(`Stored memory metadata: ${memoryId}`);
    } catch (error) {
      this.logger.error(`Failed to store memory metadata: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve memory metadata from DynamoDB
   */
  async getMemoryMetadata(tableName: string, memoryId: string): Promise<Record<string, any> | null> {
    try {
      const command = new GetItemCommand({
        TableName: tableName,
        Key: {
          memoryId: { S: memoryId },
        },
      });
      
      const response = await this.dynamoDbClient.send(command);
      
      if (!response.Item) {
        return null;
      }
      
      return this.convertFromAttributeValue(response.Item);
    } catch (error) {
      this.logger.error(`Failed to retrieve memory metadata: ${error.message}`);
      return null;
    }
  }

  /**
   * Invoke Bedrock model for AI operations
   */
  async invokeBedrockModel(
    modelId: string,
    prompt: string,
    maxTokens: number = 1000
  ): Promise<string> {
    try {
      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      
      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      return responseBody.content[0].text;
    } catch (error) {
      this.logger.error(`Failed to invoke Bedrock model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert JavaScript object to DynamoDB AttributeValue format
   */
  private convertToAttributeValue(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = { S: value };
      } else if (typeof value === 'number') {
        result[key] = { N: value.toString() };
      } else if (typeof value === 'boolean') {
        result[key] = { BOOL: value };
      } else if (Array.isArray(value)) {
        result[key] = { SS: value.map(String) };
      } else if (value && typeof value === 'object') {
        result[key] = { S: JSON.stringify(value) };
      }
    }
    
    return result;
  }

  /**
   * Convert DynamoDB AttributeValue format to JavaScript object
   */
  private convertFromAttributeValue(item: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(item)) {
      if (value.S !== undefined) {
        try {
          result[key] = JSON.parse(value.S);
        } catch {
          result[key] = value.S;
        }
      } else if (value.N !== undefined) {
        result[key] = Number(value.N);
      } else if (value.BOOL !== undefined) {
        result[key] = value.BOOL;
      } else if (value.SS !== undefined) {
        result[key] = value.SS;
      }
    }
    
    return result;
  }
}