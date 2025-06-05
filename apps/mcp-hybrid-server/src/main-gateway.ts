import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    logger.log('🚀 Starting MCP Hybrid Gateway Server...');
    
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
      abortOnError: false,
    });

    const configService = app.get(ConfigService);
    
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

    // Enable CORS for dashboard connections
    app.enableCors({
      origin: process.env.DASHBOARD_URL || 'http://localhost:3100',
      credentials: true,
    });

    // Global prefix for API routes
    app.setGlobalPrefix('api');

    // Swagger setup
    const config = new DocumentBuilder()
      .setTitle('MCP Hybrid Gateway Server')
      .setDescription('Central API gateway for MCP servers with WebSocket streaming')
      .setVersion('1.0')
      .addTag('servers', 'MCP server management')
      .addTag('tools', 'MCP tool operations')
      .addTag('health', 'Health monitoring')
      .addTag('metrics', 'System metrics')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = configService.get<number>('PORT') || 4101;
    const host = configService.get<string>('HOST') || '0.0.0.0';
    const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
    
    // Setup graceful shutdown handlers
    setupGracefulShutdown(app, logger);
    
    // Start the server
    await app.listen(port, host);
    
    // Log startup information
    logger.log('🎉 MCP Hybrid Gateway Server started successfully!');
    logger.log(`📍 Server: http://${host}:${port}`);
    logger.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
    logger.log(`📡 WebSocket Gateway: Ready for dashboard connections`);
    logger.log(`🔍 MCP Server Discovery: Active`);
    logger.log(`🛠️  Tool Registry: Ready`);
    logger.log(`❤️  Health Monitoring: Active`);
    logger.log(`🌍 Environment: ${nodeEnv}`);
    
  } catch (error: any) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

function setupGracefulShutdown(app: any, logger: Logger): void {
  const gracefulShutdown = async (signal: string) => {
    logger.log(`📴 Received ${signal}. Starting graceful shutdown...`);
    
    try {
      // Set a timeout for the shutdown process
      const shutdownTimeout = setTimeout(() => {
        logger.error('⏰ Shutdown timeout reached, forcing exit');
        process.exit(1);
      }, 10000); // 10 seconds timeout
      
      // Close the NestJS application
      await app.close();
      
      clearTimeout(shutdownTimeout);
      logger.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error: any) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };
  
  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
  });
}

// Start the application
bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('💥 Fatal error during bootstrap:', error);
  process.exit(1);
});