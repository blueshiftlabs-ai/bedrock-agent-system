import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { MCPLifecycleService } from './mcp/mcp-lifecycle.service';
import { MCPConfigValidationService } from './mcp/services/mcp-config-validation.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    logger.log('🚀 Starting Hybrid MCP Server...');
    
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
      abortOnError: false, // Continue startup even if some services fail
    });

    const configService = app.get(ConfigService);
    const mcpConfigValidation = app.get(MCPConfigValidationService);
    const mcpLifecycle = app.get(MCPLifecycleService);
    
    // Validate configuration before starting
    logger.log('🔧 Validating configuration...');
    const configValidation = mcpConfigValidation.validateConfiguration();
    if (!configValidation.valid) {
      logger.error('❌ Configuration validation failed:');
      configValidation.errors.forEach(error => logger.error(`   ${error}`));
      process.exit(1);
    }
    
    if (configValidation.warnings.length > 0) {
      logger.warn('⚠️ Configuration warnings:');
      configValidation.warnings.forEach(warning => logger.warn(`   ${warning}`));
    }
    
    // Validate environment variables
    const envValidation = mcpConfigValidation.validateEnvironmentVariables();
    if (!envValidation.valid) {
      if (envValidation.missing.length > 0) {
        logger.error(`❌ Missing required environment variables: ${envValidation.missing.join(', ')}`);
      }
      if (envValidation.invalid.length > 0) {
        logger.error(`❌ Invalid environment variables: ${envValidation.invalid.join(', ')}`);
      }
      process.exit(1);
    }
    
    logger.log('✅ Configuration validation passed');

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
    
    // Setup graceful shutdown handlers
    setupGracefulShutdown(app, logger);
    
    // Start the server
    await app.listen(port, host);
    
    // Log startup information
    const configSummary = mcpConfigValidation.getConfigSummary();
    const mcpStatus = mcpLifecycle.getServiceStatus();
    
    logger.log('🎉 Hybrid MCP Server started successfully!');
    logger.log(`📍 Server: http://${host}:${port}`);
    logger.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
    
    if (configSummary.server.enabled) {
      logger.log(`🔧 MCP Server: http://${host}:${port}${configSummary.server.endpoint}`);
    }
    
    if (configSummary.client.enabled) {
      logger.log(`🔗 MCP Client: ${mcpStatus.client.activeConnections}/${mcpStatus.client.totalConnections} connections active`);
    }
    
    logger.log(`🌍 Environment: ${nodeEnv}`);
    logger.log(`⚡ Features: ${configSummary.features.join(', ')}`);
    
    if (configSummary.warnings.length > 0) {
      logger.warn('⚠️ Configuration Warnings:');
      configSummary.warnings.forEach(warning => logger.warn(`   ${warning}`));
    }
    
    // Log MCP service status
    logger.log(`📊 MCP Status: ${mcpStatus.overall.status.toUpperCase()}`);
    
  } catch (error: any) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

function setupGracefulShutdown(app: any, logger: Logger): void {
  const gracefulShutdown = async (signal: string) => {
    logger.log(`📴 Received ${signal}. Starting graceful shutdown...`);
    
    try {
      // Get MCP lifecycle service for cleanup
      const mcpLifecycle = app.get(MCPLifecycleService);
      
      // Set a timeout for the shutdown process
      const shutdownTimeout = setTimeout(() => {
        logger.error('⏰ Shutdown timeout reached, forcing exit');
        process.exit(1);
      }, 30000); // 30 seconds timeout
      
      // Close the NestJS application (this will trigger OnModuleDestroy)
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
