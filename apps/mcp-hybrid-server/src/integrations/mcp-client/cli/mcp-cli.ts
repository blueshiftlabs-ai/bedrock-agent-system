#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MCPClientModule } from '../mcp-client.module';
import { MCPCliService } from './mcp-cli.service';

async function bootstrap() {
  // Suppress NestJS startup logs for CLI
  const logger = new Logger('MCP-CLI');
  
  try {
    // Create a minimal NestJS application context
    const app = await NestFactory.createApplicationContext(MCPClientModule, {
      logger: false, // Disable NestJS logging for CLI
    });

    // Get the CLI service
    const cliService = app.get(MCPCliService);

    // Parse command line arguments
    const args = process.argv;

    // Execute the CLI command
    await cliService.executeCommand(args);

    // Close the application context
    await app.close();
    
  } catch (error: any) {
    logger.error('CLI execution failed:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  bootstrap().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { bootstrap };