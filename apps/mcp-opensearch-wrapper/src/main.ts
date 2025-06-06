import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;
  
  await app.listen(port);
  
  const logger = new Logger('OpenSearchMCP');
  logger.log(`OpenSearch MCP Wrapper started on port ${port}`);
  logger.log(`OpenSearch endpoint: ${process.env.OPENSEARCH_ENDPOINT || 'http://localhost:9200'}`);
}

bootstrap();