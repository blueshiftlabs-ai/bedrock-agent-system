import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
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

  // Note: No global prefix to allow MCP SSE endpoint at /sse
  // Memory endpoints are prefixed in the controller itself

  const port = process.env.PORT || 4100;
  await app.listen(port);
  
  console.log(`🧠 MCP Memory Server running on port ${port}`);
  console.log(`\n🔗 MCP Endpoints:`);
  console.log(`   HTTP/Stream: http://localhost:${port}/memory/mcp`);
  console.log(`   SSE:         http://localhost:${port}/memory/sse`);
  console.log(`   STDIO:       Available for process connections`);
  console.log(`\n📡 Memory REST API: http://localhost:${port}/memory`);
  console.log(`❤️  Health check: http://localhost:${port}/memory/health`);
  console.log(`\n📚 MCP Tools Available:`);
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