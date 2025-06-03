import { NestFactory } from '@nestjs/core';
import { AppWorkflowsModule } from './app-workflows.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('WorkflowsBootstrap');
  
  try {
    logger.log('⚡ Starting MCP Workflows Service...');
    
    const app = await NestFactory.create(AppWorkflowsModule, {
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

    // Enable CORS
    app.enableCors({
      origin: true,
      credentials: true,
    });

    const port = configService.get<number>('PORT') || 3003;
    const host = configService.get<string>('HOST') || '0.0.0.0';
    const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
    
    // Setup graceful shutdown handlers
    setupGracefulShutdown(app, logger);
    
    // Start the server
    await app.listen(port, host);
    
    logger.log('🎉 MCP Workflows Service started successfully!');
    logger.log(`📍 Server: http://${host}:${port}`);
    logger.log(`💗 Health Check: http://${host}:${port}/health`);
    logger.log(`🌍 Environment: ${nodeEnv}`);
    logger.log(`⚡ Available Workflows: Code Analysis Workflow with LangGraph`);
    
  } catch (error) {
    logger.error('❌ Failed to start Workflows Service:', error);
    process.exit(1);
  }
}

function setupGracefulShutdown(app: any, logger: Logger): void {
  const gracefulShutdown = async (signal: string) => {
    logger.log(`📴 Received ${signal}. Starting graceful shutdown...`);
    
    try {
      const shutdownTimeout = setTimeout(() => {
        logger.error('⏰ Shutdown timeout reached, forcing exit');
        process.exit(1);
      }, 30000);
      
      await app.close();
      
      clearTimeout(shutdownTimeout);
      logger.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
  });
}

bootstrap().catch((error) => {
  const logger = new Logger('WorkflowsBootstrap');
  logger.error('💥 Fatal error during bootstrap:', error);
  process.exit(1);
});