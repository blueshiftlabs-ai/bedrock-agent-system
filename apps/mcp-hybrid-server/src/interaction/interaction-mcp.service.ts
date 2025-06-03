import { Injectable, Logger } from '@nestjs/common';
import { ProcessManagerService } from './process-manager.service';
import { AgentExecutorService } from './agent-executor.service';
import { WorkflowExecutorService } from './workflow-executor.service';
import {
  ProcessStartRequest,
  ProcessControlRequest,
  InteractionRequest,
  InteractionResponse,
} from '../types/interaction.types';
import {
  ProcessType,
  ProcessPriority,
  ProcessFilter,
  LongRunningProcess,
} from '../types/process.types';

@Injectable()
export class InteractionMcpService {
  private readonly logger = new Logger(InteractionMcpService.name);

  constructor(
    private readonly processManager: ProcessManagerService,
    private readonly agentExecutor: AgentExecutorService,
    private readonly workflowExecutor: WorkflowExecutorService,
  ) {}

  async handleMcpRequest(request: InteractionRequest): Promise<InteractionResponse> {
    const response: InteractionResponse = {
      id: `resp_${Date.now()}`,
      requestId: request.id,
      success: false,
      timestamp: new Date(),
    };

    try {
      switch (request.type) {
        case 'start_process':
          response.data = await this.handleStartProcess(request.payload);
          break;
        case 'control_process':
          response.data = await this.handleControlProcess(request.payload);
          break;
        case 'query_status':
          response.data = await this.handleQueryStatus(request.payload);
          break;
        case 'get_logs':
          response.data = await this.handleGetLogs(request.payload);
          break;
        case 'interact_agent':
          response.data = await this.handleAgentInteraction(request.payload);
          break;
        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }

      response.success = true;
    } catch (error: any) {
      this.logger.error(`MCP request failed: ${error.message}`, error.stack);
      response.error = {
        code: 'MCP_REQUEST_ERROR',
        message: error.message,
        details: error.stack,
      };
    }

    return response;
  }

  private async handleStartProcess(payload: ProcessStartRequest): Promise<any> {
    const processId = await this.processManager.createProcess(
      payload.name,
      payload.type as ProcessType,
      (payload.priority as ProcessPriority) || ProcessPriority.MEDIUM,
      payload.configuration || {},
      { data: payload.input },
      {
        tags: payload.tags,
        description: payload.description,
        parentProcessId: payload.parentProcessId,
      }
    );

    // Start the appropriate executor
    let executor;
    switch (payload.type) {
      case 'agent':
        executor = await this.agentExecutor.execute(processId, payload.input, payload.configuration);
        break;
      case 'workflow':
        executor = await this.workflowExecutor.execute(processId, payload.input, payload.configuration);
        break;
      default:
        throw new Error(`Unknown process type: ${payload.type}`);
    }

    await this.processManager.startProcess(processId, executor);

    return { processId, status: 'started' };
  }

  private async handleControlProcess(payload: ProcessControlRequest): Promise<any> {
    const { action, processId, parameters, force } = payload;

    switch (action) {
      case 'start':
        await this.processManager.startProcess(processId);
        break;
      case 'stop':
        await this.processManager.stopProcess(processId, force);
        break;
      case 'pause':
        await this.processManager.pauseProcess(processId);
        break;
      case 'resume':
        await this.processManager.resumeProcess(processId);
        break;
      case 'cancel':
        await this.processManager.stopProcess(processId, true);
        break;
      case 'restart':
        await this.processManager.stopProcess(processId);
        setTimeout(async () => {
          await this.processManager.startProcess(processId);
        }, 1000);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return { processId, action, status: 'success' };
  }

  private async handleQueryStatus(payload: { processId?: string; filter?: ProcessFilter }): Promise<any> {
    if (payload.processId) {
      const process = this.processManager.getProcess(payload.processId);
      if (!process) {
        throw new Error(`Process not found: ${payload.processId}`);
      }
      return { process };
    } else {
      const processes = this.processManager.getProcesses(payload.filter);
      const stats = this.processManager.getProcessStats();
      return { processes, stats };
    }
  }

  private async handleGetLogs(payload: { processId: string; level?: string; since?: string; tail?: number }): Promise<any> {
    const process = this.processManager.getProcess(payload.processId);
    if (!process) {
      throw new Error(`Process not found: ${payload.processId}`);
    }

    let logs = process.logs;

    if (payload.level) {
      logs = logs.filter(log => log.level === payload.level);
    }

    if (payload.since) {
      const sinceDate = new Date(payload.since);
      logs = logs.filter(log => log.timestamp >= sinceDate);
    }

    if (payload.tail) {
      logs = logs.slice(-payload.tail);
    }

    return { logs, total: process.logs.length };
  }

  private async handleAgentInteraction(payload: any): Promise<any> {
    // This would handle specific agent interactions like debug sessions
    // For now, return a placeholder
    return { message: 'Agent interaction not yet implemented', payload };
  }

  // MCP Tool Definitions
  getMcpTools(): any[] {
    return [
      {
        name: 'start_process',
        description: 'Start a new long-running process (agent or workflow)',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Process name' },
            type: { type: 'string', enum: ['agent', 'workflow', 'analysis', 'indexing', 'custom'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
            configuration: { type: 'object', description: 'Process configuration' },
            input: { type: 'object', description: 'Process input data' },
            tags: { type: 'array', items: { type: 'string' } },
            description: { type: 'string' },
            parentProcessId: { type: 'string' },
          },
          required: ['name', 'type', 'input'],
        },
      },
      {
        name: 'control_process',
        description: 'Control a running process (start, stop, pause, resume, cancel)',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['start', 'stop', 'pause', 'resume', 'cancel', 'restart'] },
            processId: { type: 'string' },
            parameters: { type: 'object' },
            force: { type: 'boolean', default: false },
          },
          required: ['action', 'processId'],
        },
      },
      {
        name: 'query_processes',
        description: 'Query processes with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            processId: { type: 'string' },
            filter: {
              type: 'object',
              properties: {
                status: { type: 'array', items: { type: 'string' } },
                type: { type: 'array', items: { type: 'string' } },
                priority: { type: 'array', items: { type: 'string' } },
                ownerId: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                limit: { type: 'number' },
                offset: { type: 'number' },
                sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'priority', 'name'] },
                sortOrder: { type: 'string', enum: ['asc', 'desc'] },
              },
            },
          },
        },
      },
      {
        name: 'get_process_logs',
        description: 'Get logs for a specific process',
        inputSchema: {
          type: 'object',
          properties: {
            processId: { type: 'string' },
            level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
            since: { type: 'string', format: 'date-time' },
            tail: { type: 'number' },
          },
          required: ['processId'],
        },
      },
      {
        name: 'interact_with_agent',
        description: 'Interact with an agent during execution',
        inputSchema: {
          type: 'object',
          properties: {
            processId: { type: 'string' },
            agentName: { type: 'string' },
            interactionType: { type: 'string', enum: ['input_request', 'decision_point', 'debug_command'] },
            data: { type: 'object' },
          },
          required: ['processId', 'agentName', 'interactionType'],
        },
      },
    ];
  }

  async callMcpTool(toolName: string, args: any): Promise<any> {
    const request: InteractionRequest = {
      id: `req_${Date.now()}`,
      processId: args.processId,
      type: this.mapToolNameToRequestType(toolName),
      payload: args,
      timestamp: new Date(),
    };

    return await this.handleMcpRequest(request);
  }

  private mapToolNameToRequestType(toolName: string): InteractionRequest['type'] {
    switch (toolName) {
      case 'start_process':
        return 'start_process';
      case 'control_process':
        return 'control_process';
      case 'query_processes':
        return 'query_status';
      case 'get_process_logs':
        return 'get_logs';
      case 'interact_with_agent':
        return 'interact_agent';
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}