import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config/config.module';
import { AwsService } from './aws.service';
import { BedrockService } from './bedrock.service';
import { OpenSearchService } from './opensearch.service';
import { NeptuneService } from './neptune.service';
import { S3Service } from './s3.service';
import { DynamoDBService } from './dynamodb.service';

@Module({
  imports: [ConfigurationModule],
  providers: [
    AwsService,
    BedrockService,
    OpenSearchService,
    NeptuneService,
    S3Service,
    DynamoDBService,
  ],
  exports: [AwsService, DynamoDBService],
})
export class AwsModule {}
