import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';
import { BedrockService } from './bedrock.service';

/**
 * Base AWS service providing common AWS SDK configuration and utilities
 */
@Injectable()
export class AwsService {
  private readonly logger = new Logger(AwsService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => S3Service))
    private readonly s3Service: S3Service,
    @Inject(forwardRef(() => BedrockService))
    private readonly bedrockService: BedrockService,
  ) {
    this.logger.log('AwsService initialized');
  }

  /**
   * Get AWS region from configuration
   */
  getRegion(): string {
    return this.configService.get<string>('AWS_REGION', 'us-east-1');
  }

  /**
   * Get AWS credentials configuration
   */
  getCredentialsConfig(): Record<string, any> {
    // Placeholder for credentials configuration
    return {
      region: this.getRegion(),
    };
  }

  /**
   * Validate AWS service availability
   */
  async validateServiceAvailability(serviceName: string): Promise<boolean> {
    this.logger.log(`Validating ${serviceName} availability`);
    // Placeholder implementation
    return true;
  }

  /**
   * Get Bedrock service instance
   */
  getBedrockService(): BedrockService {
    return this.bedrockService;
  }

  /**
   * Store data in S3
   */
  async storeInS3(
    key: string,
    data: string | Buffer,
    contentType?: string,
  ): Promise<string> {
    return this.s3Service.putObject(key, data, contentType);
  }

  /**
   * Retrieve data from S3
   */
  async getFromS3(key: string): Promise<Buffer | null> {
    return this.s3Service.getObject(key);
  }
}