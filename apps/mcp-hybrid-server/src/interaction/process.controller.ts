import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ProcessManagerService } from './process-manager.service';
import { AgentExecutorService } from './agent-executor.service';
import { WorkflowExecutorService } from './workflow-executor.service';
import {
  ProcessStartRequest,
  ProcessControlRequest,
  LogStreamRequest,
} from '../types/interaction.types';
import {
  ProcessFilter,
  ProcessType,
  ProcessPriority,
  ProcessStatus,
  LongRunningProcess,
  ProcessStats,
} from '../types/process.types';

@ApiTags('process-management')
@Controller('api/processes')
export class ProcessController {
  private readonly logger = new Logger(ProcessController.name);

  constructor(
    private readonly processManager: ProcessManagerService,
    private readonly agentExecutor: AgentExecutorService,
    private readonly workflowExecutor: WorkflowExecutorService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Start a new process' })
  @ApiResponse({ status: 201, description: 'Process started successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async startProcess(@Body() request: ProcessStartRequest): Promise<{ processId: string }> {
    this.logger.log(`Starting process: ${request.name} (${request.type})`);

    try {
      const processId = await this.processManager.createProcess(
        request.name,
        request.type as ProcessType,
        (request.priority as ProcessPriority) || ProcessPriority.MEDIUM,
        request.configuration || {},
        { data: request.input },
        {
          tags: request.tags,
          description: request.description,
          parentProcessId: request.parentProcessId,
        }
      );

      // Start the appropriate executor based on type
      let executor;
      switch (request.type) {
        case 'agent':
          executor = await this.agentExecutor.execute(processId, request.input, request.configuration);
          break;
        case 'workflow':
          executor = await this.workflowExecutor.execute(processId, request.input, request.configuration);
          break;
        default:
          throw new BadRequestException(`Unknown process type: ${request.type}`);
      }

      await this.processManager.startProcess(processId, executor);

      return { processId };
    } catch (error: any) {
      this.logger.error(`Failed to start process: ${error.message}`);
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get list of processes' })
  @ApiQuery({ name: 'status', required: false, isArray: true })
  @ApiQuery({ name: 'type', required: false, isArray: true })
  @ApiQuery({ name: 'priority', required: false, isArray: true })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of processes' })
  async getProcesses(
    @Query('status') status?: string | string[],
    @Query('type') type?: string | string[],
    @Query('priority') priority?: string | string[],
    @Query('ownerId') ownerId?: string,
    @Query('tags') tags?: string | string[],
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy') sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'name',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ): Promise<{ processes: LongRunningProcess[]; total: number }> {
    const filter: ProcessFilter = {
      status: status ? (Array.isArray(status) ? status as ProcessStatus[] : [status as ProcessStatus]) : undefined,
      type: type ? (Array.isArray(type) ? type as ProcessType[] : [type as ProcessType]) : undefined,
      priority: priority ? (Array.isArray(priority) ? priority as ProcessPriority[] : [priority as ProcessPriority]) : undefined,
      ownerId,
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
      limit,
      offset,
      sortBy,
      sortOrder,
    };

    const processes = this.processManager.getProcesses(filter);
    const total = this.processManager.getProcesses().length; // Get total count without pagination

    return { processes, total };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get process statistics' })
  @ApiResponse({ status: 200, description: 'Process statistics' })
  async getProcessStats(): Promise<ProcessStats> {
    return this.processManager.getProcessStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get process by ID' })
  @ApiParam({ name: 'id', description: 'Process ID' })
  @ApiResponse({ status: 200, description: 'Process details' })
  @ApiResponse({ status: 404, description: 'Process not found' })
  async getProcess(@Param('id') processId: string): Promise<LongRunningProcess> {
    const process = this.processManager.getProcess(processId);
    if (!process) {
      throw new NotFoundException(`Process not found: ${processId}`);
    }
    return process;
  }

  @Put(':id/control')
  @ApiOperation({ summary: 'Control process (start, stop, pause, resume, cancel)' })
  @ApiParam({ name: 'id', description: 'Process ID' })
  @ApiResponse({ status: 200, description: 'Control action executed' })
  @ApiResponse({ status: 404, description: 'Process not found' })
  @ApiResponse({ status: 400, description: 'Invalid action' })
  async controlProcess(
    @Param('id') processId: string,
    @Body() request: ProcessControlRequest,
  ): Promise<{ success: boolean; message: string }> {
    const process = this.processManager.getProcess(processId);
    if (!process) {
      throw new NotFoundException(`Process not found: ${processId}`);
    }

    this.logger.log(`Control action ${request.action} for process ${processId}`);

    try {
      switch (request.action) {
        case 'start':
          await this.processManager.startProcess(processId);
          break;
        case 'stop':
          await this.processManager.stopProcess(processId, request.force);
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
          // Wait a moment before restarting
          setTimeout(async () => {
            try {
              await this.processManager.startProcess(processId);
            } catch (error: any) {
              this.logger.error(`Failed to restart process ${processId}: ${error.message}`);
            }
          }, 1000);
          break;
        default:
          throw new BadRequestException(`Unknown action: ${request.action}`);
      }

      return {
        success: true,
        message: `Action ${request.action} executed successfully`,
      };
    } catch (error: any) {
      this.logger.error(`Control action failed for process ${processId}: ${error.message}`);
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get process logs' })
  @ApiParam({ name: 'id', description: 'Process ID' })
  @ApiQuery({ name: 'level', required: false })
  @ApiQuery({ name: 'since', required: false })
  @ApiQuery({ name: 'tail', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Process logs' })
  @ApiResponse({ status: 404, description: 'Process not found' })
  async getProcessLogs(
    @Param('id') processId: string,
    @Query('level') level?: string,
    @Query('since') since?: string,
    @Query('tail') tail?: number,
  ) {
    const process = this.processManager.getProcess(processId);
    if (!process) {
      throw new NotFoundException(`Process not found: ${processId}`);
    }

    let logs = process.logs;

    // Apply filters
    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    if (since) {
      const sinceDate = new Date(since);
      logs = logs.filter(log => log.timestamp >= sinceDate);
    }

    if (tail) {
      logs = logs.slice(-tail);
    }

    return {
      logs,
      total: process.logs.length,
      filtered: logs.length,
    };
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get process status' })
  @ApiParam({ name: 'id', description: 'Process ID' })
  @ApiResponse({ status: 200, description: 'Process status' })
  @ApiResponse({ status: 404, description: 'Process not found' })
  async getProcessStatus(@Param('id') processId: string) {
    const process = this.processManager.getProcess(processId);
    if (!process) {
      throw new NotFoundException(`Process not found: ${processId}`);
    }

    return {
      id: processId,
      status: process.metadata.status,
      progress: process.progress,
      startedAt: process.metadata.startedAt,
      completedAt: process.metadata.completedAt,
      duration: process.metadata.startedAt && process.metadata.completedAt
        ? process.metadata.completedAt.getTime() - process.metadata.startedAt.getTime()
        : process.metadata.startedAt
        ? Date.now() - process.metadata.startedAt.getTime()
        : null,
      error: process.error,
    };
  }

  @Get(':id/resources')
  @ApiOperation({ summary: 'Get process resource usage' })
  @ApiParam({ name: 'id', description: 'Process ID' })
  @ApiQuery({ name: 'since', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Process resource usage' })
  @ApiResponse({ status: 404, description: 'Process not found' })
  async getProcessResources(
    @Param('id') processId: string,
    @Query('since') since?: string,
    @Query('limit') limit?: number,
  ) {
    const process = this.processManager.getProcess(processId);
    if (!process) {
      throw new NotFoundException(`Process not found: ${processId}`);
    }

    let resourceUsage = process.resourceUsage || [];

    if (since) {
      const sinceDate = new Date(since);
      resourceUsage = resourceUsage.filter(usage => usage.timestamp >= sinceDate);
    }

    if (limit) {
      resourceUsage = resourceUsage.slice(-limit);
    }

    const latest = resourceUsage[resourceUsage.length - 1];
    const peak = resourceUsage.reduce(
      (peak, current) => ({
        cpu: Math.max(peak.cpu, current.cpu),
        memory: Math.max(peak.memory, current.memory),
        disk: Math.max(peak.disk, current.disk),
      }),
      { cpu: 0, memory: 0, disk: 0 }
    );

    const average = resourceUsage.length > 0
      ? resourceUsage.reduce(
          (sum, current) => ({
            cpu: sum.cpu + current.cpu,
            memory: sum.memory + current.memory,
            disk: sum.disk + current.disk,
          }),
          { cpu: 0, memory: 0, disk: 0 }
        )
      : { cpu: 0, memory: 0, disk: 0 };

    if (resourceUsage.length > 0) {
      average.cpu /= resourceUsage.length;
      average.memory /= resourceUsage.length;
      average.disk /= resourceUsage.length;
    }

    return {
      current: latest,
      peak,
      average,
      history: resourceUsage,
      samples: resourceUsage.length,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete process' })
  @ApiParam({ name: 'id', description: 'Process ID' })
  @ApiResponse({ status: 204, description: 'Process deleted' })
  @ApiResponse({ status: 404, description: 'Process not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProcess(@Param('id') processId: string): Promise<void> {
    const process = this.processManager.getProcess(processId);
    if (!process) {
      throw new NotFoundException(`Process not found: ${processId}`);
    }

    // Stop the process if it's running
    if (process.metadata.status === ProcessStatus.RUNNING || 
        process.metadata.status === ProcessStatus.PAUSED) {
      await this.processManager.stopProcess(processId, true);
    }

    // Remove from manager (implement this method)
    // this.processManager.deleteProcess(processId);

    this.logger.log(`Deleted process: ${processId}`);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Get available process templates' })
  @ApiResponse({ status: 200, description: 'List of process templates' })
  async getProcessTemplates() {
    // This would typically come from a database or configuration
    return {
      templates: [
        {
          id: 'code-analysis',
          name: 'Code Analysis',
          description: 'Analyze code structure and quality',
          type: 'workflow',
          configurationSchema: {
            type: 'object',
            properties: {
              analysisType: {
                type: 'string',
                enum: ['basic', 'advanced', 'security'],
                default: 'basic',
              },
              includeDependencies: {
                type: 'boolean',
                default: false,
              },
            },
          },
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to the file or directory to analyze',
              },
              language: {
                type: 'string',
                description: 'Programming language',
              },
            },
            required: ['filePath'],
          },
        },
        {
          id: 'document-generation',
          name: 'Document Generation',
          description: 'Generate documentation from code',
          type: 'agent',
          configurationSchema: {
            type: 'object',
            properties: {
              format: {
                type: 'string',
                enum: ['markdown', 'html', 'pdf'],
                default: 'markdown',
              },
              includeExamples: {
                type: 'boolean',
                default: true,
              },
            },
          },
          inputSchema: {
            type: 'object',
            properties: {
              sourceCode: {
                type: 'string',
                description: 'Source code to document',
              },
              outputPath: {
                type: 'string',
                description: 'Where to save the documentation',
              },
            },
            required: ['sourceCode'],
          },
        },
      ],
    };
  }
}