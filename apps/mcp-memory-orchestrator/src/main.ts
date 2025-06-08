import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('MemoryOrchestrator');
  
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for cross-origin requests
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  const port = process.env.PORT || 4200;
  
  await app.listen(port);
  
  logger.log(`Memory Orchestrator MCP Server started on port ${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV}`);
  logger.log(`MCP Endpoints configured:`);
  logger.log(`  - OpenSearch MCP: ${process.env.OPENSEARCH_MCP_ENDPOINT}`);
  logger.log(`  - Database MCP: ${process.env.DATABASE_MCP_ENDPOINT}`);
  logger.log(`  - Graph MCP: ${process.env.GRAPH_MCP_ENDPOINT}`);
}

bootstrap();