import { NestFactory } from '@nestjs/core';
import { AppAgentsModule } from './app-agents.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('AgentsBootstrap');
  
  try {
    logger.log('🤖 Starting MCP Agents Service...');
    
    const app = await NestFactory.create(AppAgentsModule, {
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

    const port = configService.get<number>('PORT') || 3001;
    const host = configService.get<string>('HOST') || '0.0.0.0';
    const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
    
    // Setup graceful shutdown handlers
    setupGracefulShutdown(app, logger);
    
    // Start the server
    await app.listen(port, host);
    
    logger.log('🎉 MCP Agents Service started successfully!');
    logger.log(`📍 Server: http://${host}:${port}`);
    logger.log(`💗 Health Check: http://${host}:${port}/health`);
    logger.log(`🌍 Environment: ${nodeEnv}`);
    logger.log(`🤖 Available Agents: Code Analyzer, Database Analyzer, Knowledge Builder, Documentation Generator`);
    
  } catch (error: any) {
    logger.error('❌ Failed to start Agents Service:', error);
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
    } catch (error: any) {
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
  const logger = new Logger('AgentsBootstrap');
  logger.error('💥 Fatal error during bootstrap:', error);
  process.exit(1);
});