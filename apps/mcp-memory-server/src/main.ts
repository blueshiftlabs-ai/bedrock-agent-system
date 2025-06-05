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

  // Set global prefix for all routes
  app.setGlobalPrefix('memory');

  const port = process.env.PORT || 4100;
  await app.listen(port);
  
  console.log(`🧠 MCP Memory Server running on port ${port}`);
  console.log(`🔗 MCP endpoint: http://localhost:${port}/memory/mcp`);
  console.log(`❤️  Health check: http://localhost:${port}/memory/health`);
}

bootstrap().catch(err => {
  console.error('Failed to start MCP Memory Server:', err);
  process.exit(1);
});