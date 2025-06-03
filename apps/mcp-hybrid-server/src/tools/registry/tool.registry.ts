import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getErrorMessage } from '@/common/utils/error-utils';

export interface MCPToolParameter {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}

export interface MCPToolParameterSchema {
  type: string;
  required: string[];
  properties: Record<string, MCPToolParameter>;
}

export interface MCPTool {
  name: string;
  description: string;
  category: string;
  parameters: MCPToolParameterSchema;
  execute: (params: any, context?: any) => Promise<any>;
  timeout?: number;
  retryable?: boolean;
  cacheable?: boolean;
}

@Injectable()
export class MCPToolRegistry {
  private readonly logger = new Logger(MCPToolRegistry.name);
  private tools: Map<string, MCPTool> = new Map();
  private toolCategories: Map<string, string[]> = new Map();
  private executionMetrics: Map<string, any> = new Map();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  registerTool(tool: MCPTool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool '${tool.name}' is already registered. Overwriting.`);
    }
    
    this.tools.set(tool.name, tool);
    
    // Update category mapping
    if (!this.toolCategories.has(tool.category)) {
      this.toolCategories.set(tool.category, []);
    }
    this.toolCategories.get(tool.category)!.push(tool.name);
    
    this.logger.log(`Registered tool: ${tool.name} (category: ${tool.category})`);
    
    // Emit registration event
    this.eventEmitter.emit('tool.registered', { toolName: tool.name, category: tool.category });
  }

  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  getToolsByCategory(category: string): MCPTool[] {
    const toolNames = this.toolCategories.get(category) || [];
    return toolNames.map(name => this.tools.get(name)!).filter(Boolean);
  }

  getAllTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  getRelevantTools(modelInput: string, maxTools: number = 10): MCPTool[] {
    const input = modelInput.toLowerCase();
    const scoredTools: Array<{ tool: MCPTool; score: number }> = [];
    
    // Enhanced keyword-based tool selection with scoring
    for (const tool of this.tools.values()) {
      let score = 0;
      
      // Check tool name
      if (input.includes(tool.name.toLowerCase())) {
        score += 10;
      }
      
      // Check tool description
      const descWords = tool.description.toLowerCase().split(' ');
      const inputWords = input.split(' ');
      
      for (const word of inputWords) {
        if (descWords.some(descWord => descWord.includes(word) || word.includes(descWord))) {
          score += 2;
        }
      }
      
      // Check tool category
      if (input.includes(tool.category.toLowerCase())) {
        score += 5;
      }
      
      // Boost score based on execution success rate
      const metrics = this.executionMetrics.get(tool.name);
      if (metrics && metrics.successRate > 0.8) {
        score += 3;
      }
      
      if (score > 0) {
        scoredTools.push({ tool, score });
      }
    }
    
    // Sort by score and return top tools
    scoredTools.sort((a, b) => b.score - a.score);
    return scoredTools.slice(0, maxTools).map(item => item.tool);
  }

  formatToolsForMCP(): any[] {
    return this.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters,
      timeout: tool.timeout,
      retryable: tool.retryable,
      cacheable: tool.cacheable,
    }));
  }

  async executeTool(toolName: string, parameters: any, context?: any): Promise<any> {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    const startTime = Date.now();
    
    try {
      this.logger.log(`Executing tool: ${toolName}`);
      this.eventEmitter.emit('tool.execution.started', { toolName, parameters });
      
      // Apply timeout if specified
      let result;
      if (tool.timeout) {
        result = await Promise.race([
          tool.execute(parameters, context),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Tool execution timeout: ${toolName}`)), tool.timeout)
          )
        ]);
      } else {
        result = await tool.execute(parameters, context);
      }
      
      const executionTime = Date.now() - startTime;
      this.updateExecutionMetrics(toolName, true, executionTime);
      
      this.logger.log(`Tool executed successfully: ${toolName} (${executionTime}ms)`);
      this.eventEmitter.emit('tool.execution.completed', { toolName, executionTime, success: true });
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateExecutionMetrics(toolName, false, executionTime);
      
      this.logger.error(`Tool execution failed: ${toolName} - ${getErrorMessage(error)}`);
      this.eventEmitter.emit('tool.execution.failed', { toolName, error: getErrorMessage(error), executionTime });
      
      throw error;
    }
  }

  private updateExecutionMetrics(toolName: string, success: boolean, executionTime: number): void {
    if (!this.executionMetrics.has(toolName)) {
      this.executionMetrics.set(toolName, {
        totalExecutions: 0,
        successfulExecutions: 0,
        totalTime: 0,
        averageTime: 0,
        successRate: 0,
      });
    }
    
    const metrics = this.executionMetrics.get(toolName)!;
    metrics.totalExecutions++;
    metrics.totalTime += executionTime;
    metrics.averageTime = metrics.totalTime / metrics.totalExecutions;
    
    if (success) {
      metrics.successfulExecutions++;
    }
    
    metrics.successRate = metrics.successfulExecutions / metrics.totalExecutions;
  }

  getExecutionMetrics(toolName?: string): any {
    if (toolName) {
      return this.executionMetrics.get(toolName) || null;
    }
    return Object.fromEntries(this.executionMetrics);
  }

  getToolCategories(): string[] {
    return Array.from(this.toolCategories.keys());
  }

  unregisterTool(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) {
      this.logger.warn(`Attempted to unregister non-existent tool: ${toolName}`);
      return false;
    }

    // Remove from tools map
    this.tools.delete(toolName);

    // Update category mapping
    const category = tool.category;
    const toolNames = this.toolCategories.get(category);
    if (toolNames) {
      const index = toolNames.indexOf(toolName);
      if (index > -1) {
        toolNames.splice(index, 1);
        if (toolNames.length === 0) {
          this.toolCategories.delete(category);
        }
      }
    }

    // Clear execution metrics
    this.executionMetrics.delete(toolName);

    this.logger.log(`Unregistered tool: ${toolName}`);
    
    // Emit unregistration event
    this.eventEmitter.emit('tool.unregistered', { toolName, category });
    
    return true;
  }

  unregisterToolsByCategory(category: string): number {
    const toolNames = this.toolCategories.get(category);
    if (!toolNames) {
      return 0;
    }

    const toolNamesToRemove = [...toolNames]; // Create copy
    let removedCount = 0;

    for (const toolName of toolNamesToRemove) {
      if (this.unregisterTool(toolName)) {
        removedCount++;
      }
    }

    return removedCount;
  }

  unregisterToolsByPattern(pattern: RegExp): number {
    const toolNames = Array.from(this.tools.keys());
    let removedCount = 0;

    for (const toolName of toolNames) {
      if (pattern.test(toolName) && this.unregisterTool(toolName)) {
        removedCount++;
      }
    }

    return removedCount;
  }
}
