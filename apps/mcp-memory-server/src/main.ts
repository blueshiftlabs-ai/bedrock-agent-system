import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: isDevelopment 
      ? ['error', 'warn', 'log', 'debug', 'verbose'] 
      : ['error', 'warn', 'log'],
  });
  
  // Enable validation pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Enable CORS for cross-service communication
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // No global prefix needed - controllers handle their own paths
  // Memory REST API uses @Controller('memory')
  // MCP endpoints configured with custom paths in module

  const port = process.env.PORT || 4100;
  await app.listen(port);
  
  console.log(`🧠 MCP Memory Server running on port ${port}`);
  console.log(`\n🔗 MCP Endpoint:`);
  console.log(`   HTTP/Stream: http://localhost:${port}/memory/mcp (use this for all MCP clients)`);
  console.log(`   HTTP/Stream: http://localhost:${port}/memory/sse (use this for all MCP SSE only clients)`);
  console.log(`\n❤️  Health check: http://localhost:${port}/memory/health`);
  console.log(`\n📚 MCP Tools Available (use MCP protocol only):`);
  console.log(`   - store-memory: Store memories with semantic understanding`);
  console.log(`   - retrieve-memories: Retrieve using semantic search`);
  console.log(`   - add-connection: Create knowledge graph connections`);
  console.log(`   - create-observation: Store agent observations`);
  console.log(`   - consolidate-memories: Deduplicate and merge memories`);
  console.log(`   - delete-memory: Remove memories`);
  console.log(`   - get-memory-statistics: Get memory analytics`);
}

bootstrap().catch(err => {
  console.error('Failed to start MCP Memory Server:', err);
  process.exit(1);
});