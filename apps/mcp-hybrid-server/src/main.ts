import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Swagger setup with comprehensive documentation
  const config = new DocumentBuilder()
    .setTitle('Hybrid MCP Server')
    .setDescription('Advanced Model Context Protocol server with NestJS and LangGraph integration')
    .setVersion('1.0')
    .addTag('memory', 'Memory management operations')
    .addTag('workflows', 'AI workflow orchestration')
    .addTag('tools', 'MCP tool operations')
    .addTag('agents', 'AI agent interactions')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT') || 3000;
  const host = configService.get<string>('HOST') || '0.0.0.0';
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';

  await app.listen(port, host);
  
  logger.log(`🚀 Hybrid MCP Server is running on: http://${host}:${port}`);
  logger.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
  logger.log(`🔧 MCP Endpoint: http://${host}:${port}/mcp`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`🤖 AI Workflows: Enabled with LangGraph`);
}

bootstrap();
