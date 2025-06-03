import { Injectable, Logger } from '@nestjs/common';
import { MCPToolRegistry } from './registry/tool.registry';

@Injectable()
export class ToolService {
  private readonly logger = new Logger(ToolService.name);

  constructor(private readonly toolRegistry: MCPToolRegistry) {}

  async executeTool(toolName: string, parameters: any, context?: any): Promise<any> {
    return await this.toolRegistry.executeTool(toolName, parameters, context);
  }

  getAvailableTools(): any[] {
    return this.toolRegistry.formatToolsForMCP();
  }

  getToolsByCategory(category: string): any[] {
    return this.toolRegistry.getToolsByCategory(category).map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters,
    }));
  }

  getToolMetrics(toolName?: string): any {
    return this.toolRegistry.getExecutionMetrics(toolName);
  }

  getToolCategories(): string[] {
    return this.toolRegistry.getToolCategories();
  }
}
