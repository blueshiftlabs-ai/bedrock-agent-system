import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards,
  UseInterceptors,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UsePipes,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { z } from 'zod';
import { DynamicToolService } from './dynamic-tool.service';
import { ToolAuthGuard } from './guards/tool-auth.guard';
import { ToolPermissionGuard } from './guards/tool-permission.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import {
  ToolMetadata,
  ToolSearchCriteria,
  ToolSearchResult,
  ToolInstallationConfig,
  ToolConfiguration,
  ToolEvent,
  ToolValidationResult,
} from './interfaces/tool-management.interface';
import {
  ToolSearchDto,
  ToolInstallDto,
  ToolConfigurationDto,
  ToolSearchSchema,
  ToolInstallSchema,
  ToolConfigurationSchema,
  validateToolSearch,
  validateToolInstall,
  validateToolConfiguration,
} from './dto/tool-management.dto';

// Zod validation pipe for request validation
class ZodValidationPipe {
  constructor(private schema: z.ZodSchema) {}

  transform(value: any) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        throw new BadRequestException(`Validation failed: ${messages}`);
      }
      throw new BadRequestException('Validation failed');
    }
  }
}

@ApiTags('Tool Management')
@ApiBearerAuth()
@Controller('api/v1/tools')
@UseGuards(ToolAuthGuard)
@UseInterceptors(LoggingInterceptor)
export class ToolController {
  private readonly logger = new Logger(ToolController.name);

  constructor(private readonly dynamicToolService: DynamicToolService) {}

  @Get()
  @ApiOperation({ summary: 'List all tools with optional filtering' })
  @ApiResponse({ status: 200, description: 'Tools retrieved successfully' })
  @ApiQuery({ name: 'query', required: false, description: 'Search query' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'enabled', required: false, description: 'Filter by enabled status' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit results', type: Number })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset for pagination', type: Number })
  async listTools(@Query() searchQuery: any): Promise<ToolSearchResult> {
    try {
      // Validate query parameters with Zod
      const searchDto = validateToolSearch(searchQuery);
      
      const criteria: ToolSearchCriteria = {
        ...searchDto,
        limit: searchDto.limit || 50,
        offset: searchDto.offset || 0,
      };

      return this.dynamicToolService.searchTools(criteria);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        throw new BadRequestException(`Invalid search parameters: ${messages}`);
      }
      this.logger.error('Failed to list tools:', error);
      throw new BadRequestException('Failed to retrieve tools');
    }
  }

  @Get(':toolId')
  @ApiOperation({ summary: 'Get tool details by ID' })
  @ApiResponse({ status: 200, description: 'Tool details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  @ApiParam({ name: 'toolId', description: 'Tool identifier' })
  async getToolDetails(@Param('toolId') toolId: string): Promise<ToolMetadata> {
    const tool = this.dynamicToolService.getToolMetadata(toolId);
    
    if (!tool) {
      throw new NotFoundException(`Tool with ID ${toolId} not found`);
    }

    return tool;
  }

  @Post('install')
  @UseGuards(ToolPermissionGuard.requiredPermissions('tool:install'))
  @ApiOperation({ summary: 'Install a new tool' })
  @ApiResponse({ status: 201, description: 'Tool installed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid installation configuration' })
  @ApiResponse({ status: 409, description: 'Tool already exists' })
  @ApiBody({ type: ToolInstallDto })
  async installTool(@Body() installBody: any): Promise<ToolValidationResult> {
    try {
      // Validate install configuration with Zod
      const installConfig = validateToolInstall(installBody) as ToolInstallationConfig;
      
      return await this.dynamicToolService.installTool(installConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        throw new BadRequestException(`Invalid installation configuration: ${messages}`);
      }
      
      this.logger.error('Failed to install tool:', error);
      
      if (error.message.includes('already exists')) {
        throw new ConflictException(error.message);
      }
      
      throw new BadRequestException(`Tool installation failed: ${error.message}`);
    }
  }

  @Post(':toolId/enable')
  @UseGuards(ToolPermissionGuard.requiredPermissions('tool:manage'))
  @ApiOperation({ summary: 'Enable a tool' })
  @ApiResponse({ status: 200, description: 'Tool enabled successfully' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  @ApiParam({ name: 'toolId', description: 'Tool identifier' })
  async enableTool(@Param('toolId') toolId: string): Promise<{ success: boolean; message: string }> {
    const success = await this.dynamicToolService.enableTool(toolId);
    
    if (!success) {
      throw new NotFoundException(`Tool with ID ${toolId} not found`);
    }

    return { success: true, message: `Tool ${toolId} enabled successfully` };
  }

  @Post(':toolId/disable')
  @UseGuards(ToolPermissionGuard.requiredPermissions('tool:manage'))
  @ApiOperation({ summary: 'Disable a tool' })
  @ApiResponse({ status: 200, description: 'Tool disabled successfully' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  @ApiParam({ name: 'toolId', description: 'Tool identifier' })
  async disableTool(@Param('toolId') toolId: string): Promise<{ success: boolean; message: string }> {
    const success = await this.dynamicToolService.disableTool(toolId);
    
    if (!success) {
      throw new NotFoundException(`Tool with ID ${toolId} not found`);
    }

    return { success: true, message: `Tool ${toolId} disabled successfully` };
  }

  @Delete(':toolId')
  @UseGuards(ToolPermissionGuard.requiredPermissions('tool:uninstall'))
  @ApiOperation({ summary: 'Uninstall a tool' })
  @ApiResponse({ status: 200, description: 'Tool uninstalled successfully' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  @ApiParam({ name: 'toolId', description: 'Tool identifier' })
  async uninstallTool(@Param('toolId') toolId: string): Promise<{ success: boolean; message: string }> {
    const success = await this.dynamicToolService.uninstallTool(toolId);
    
    if (!success) {
      throw new NotFoundException(`Tool with ID ${toolId} not found`);
    }

    return { success: true, message: `Tool ${toolId} uninstalled successfully` };
  }

  @Post(':toolId/reload')
  @UseGuards(ToolPermissionGuard.requiredPermissions('tool:manage'))
  @ApiOperation({ summary: 'Hot reload a tool' })
  @ApiResponse({ status: 200, description: 'Tool reloaded successfully' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  @ApiParam({ name: 'toolId', description: 'Tool identifier' })
  async reloadTool(@Param('toolId') toolId: string): Promise<{ success: boolean; message: string }> {
    const success = await this.dynamicToolService.reloadTool(toolId);
    
    if (!success) {
      throw new NotFoundException(`Tool with ID ${toolId} not found or reload failed`);
    }

    return { success: true, message: `Tool ${toolId} reloaded successfully` };
  }

  @Get(':toolId/health')
  @ApiOperation({ summary: 'Get tool health status' })
  @ApiResponse({ status: 200, description: 'Tool health status retrieved' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  @ApiParam({ name: 'toolId', description: 'Tool identifier' })
  async getToolHealth(@Param('toolId') toolId: string): Promise<any> {
    const health = await this.dynamicToolService.getToolHealth(toolId);
    
    if (!health) {
      throw new NotFoundException(`Tool with ID ${toolId} not found or health check not configured`);
    }

    return health;
  }

  @Get(':toolId/configuration')
  @ApiOperation({ summary: 'Get tool configuration' })
  @ApiResponse({ status: 200, description: 'Tool configuration retrieved' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  @ApiParam({ name: 'toolId', description: 'Tool identifier' })
  async getToolConfiguration(@Param('toolId') toolId: string): Promise<ToolConfiguration | null> {
    const config = this.dynamicToolService.getToolConfiguration(toolId);
    
    if (config === undefined) {
      throw new NotFoundException(`Tool with ID ${toolId} not found`);
    }

    return config;
  }

  @Put(':toolId/configuration')
  @UseGuards(ToolPermissionGuard.requiredPermissions('tool:configure'))
  @ApiOperation({ summary: 'Update tool configuration' })
  @ApiResponse({ status: 200, description: 'Tool configuration updated successfully' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  @ApiParam({ name: 'toolId', description: 'Tool identifier' })
  @ApiBody({ type: ToolConfigurationDto })
  async updateToolConfiguration(
    @Param('toolId') toolId: string,
    @Body() configBody: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate configuration with Zod
      const configuration = validateToolConfiguration(configBody).configuration as ToolConfiguration;
      
      const success = this.dynamicToolService.setToolConfiguration(toolId, configuration);
      
      if (!success) {
        throw new NotFoundException(`Tool with ID ${toolId} not found`);
      }

      return { success: true, message: `Configuration updated for tool ${toolId}` };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        throw new BadRequestException(`Invalid configuration: ${messages}`);
      }
      
      throw error;
    }
  }

  @Get(':toolId/events')
  @ApiOperation({ summary: 'Get tool event history' })
  @ApiResponse({ status: 200, description: 'Tool events retrieved successfully' })
  @ApiParam({ name: 'toolId', description: 'Tool identifier' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of events', type: Number })
  async getToolEvents(
    @Param('toolId') toolId: string,
    @Query('limit') limit: number = 100
  ): Promise<ToolEvent[]> {
    return this.dynamicToolService.getEventHistory(toolId, limit);
  }

  @Post(':toolId/execute')
  @UseGuards(ToolPermissionGuard.requiredPermissions('tool:execute'))
  @ApiOperation({ summary: 'Execute a tool with parameters' })
  @ApiResponse({ status: 200, description: 'Tool executed successfully' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  @ApiParam({ name: 'toolId', description: 'Tool identifier' })
  async executeTool(
    @Param('toolId') toolId: string,
    @Body() body: { parameters: any; context?: any }
  ): Promise<any> {
    try {
      return await this.dynamicToolService.executeTool(toolId, body.parameters, body.context);
    } catch (error) {
      this.logger.error(`Tool execution failed for ${toolId}:`, error);
      throw new BadRequestException(`Tool execution failed: ${error.message}`);
    }
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all tool categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async getCategories(): Promise<string[]> {
    return this.dynamicToolService.getToolCategories();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get tool system statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getSystemStats(): Promise<any> {
    return this.dynamicToolService.getSystemStats();
  }

  @Get('events')
  @ApiOperation({ summary: 'Get system-wide tool events' })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of events', type: Number })
  async getSystemEvents(@Query('limit') limit: number = 100): Promise<ToolEvent[]> {
    return this.dynamicToolService.getEventHistory(undefined, limit);
  }

  @Post('validate')
  @UseGuards(ToolPermissionGuard.requiredPermissions('tool:validate'))
  @ApiOperation({ summary: 'Validate tool metadata without installing' })
  @ApiResponse({ status: 200, description: 'Tool validation completed' })
  async validateTool(@Body() toolMetadata: ToolMetadata): Promise<ToolValidationResult> {
    return this.dynamicToolService.validateTool(toolMetadata);
  }
}