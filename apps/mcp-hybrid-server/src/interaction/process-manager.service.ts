import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import {
  LongRunningProcess,
  ProcessMetadata,
  ProcessConfiguration,
  ProcessInput,
  ProcessOutput,
  ProcessStatus,
  ProcessType,
  ProcessPriority,
  ProcessLog,
  ProcessResourceUsage,
  ProcessProgress,
  ProcessAction,
  ProcessEvent,
  ProcessFilter,
  ProcessStats,
  AgentInteraction,
  WorkflowState,
  ProcessError
} from '../types/process.types';

@Injectable()
export class ProcessManagerService {
  private readonly logger = new Logger(ProcessManagerService.name);
  private readonly processes = new Map<string, LongRunningProcess>();
  private readonly activeExecutions = new Map<string, any>();
  private readonly resourceMonitors = new Map<string, NodeJS.Timeout>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async createProcess(
    name: string,
    type: ProcessType,
    priority: ProcessPriority,
    configuration: ProcessConfiguration,
    input: ProcessInput,
    options?: {
      ownerId?: string;
      parentProcessId?: string;
      tags?: string[];
      description?: string;
    }
  ): Promise<string> {
    const processId = uuidv4();
    const now = new Date();

    const metadata: ProcessMetadata = {
      id: processId,
      name,
      type,
      status: ProcessStatus.PENDING,
      priority,
      createdAt: now,
      updatedAt: now,
      ownerId: options?.ownerId,
      parentProcessId: options?.parentProcessId,
      childProcessIds: [],
      tags: options?.tags || [],
      description: options?.description,
    };

    const process: LongRunningProcess = {
      metadata,
      configuration,
      input,
      logs: [],
    };

    this.processes.set(processId, process);

    // Add to parent's children if applicable
    if (options?.parentProcessId) {
      const parent = this.processes.get(options.parentProcessId);
      if (parent) {
        parent.metadata.childProcessIds.push(processId);
        this.updateProcess(options.parentProcessId, { metadata: parent.metadata });
      }
    }

    this.addLog(processId, 'info', `Process created: ${name}`, 'ProcessManager');
    this.emitEvent('status_change', processId, { status: ProcessStatus.PENDING });

    this.logger.log(`Created process: ${processId} (${name})`);
    return processId;
  }

  async startProcess(processId: string, executor?: any): Promise<void> {
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process not found: ${processId}`);
    }

    if (process.metadata.status !== ProcessStatus.PENDING && process.metadata.status !== ProcessStatus.PAUSED) {
      throw new Error(`Process cannot be started from status: ${process.metadata.status}`);
    }

    // Check dependencies
    if (process.configuration.dependencies) {
      for (const depId of process.configuration.dependencies) {
        const dep = this.processes.get(depId);
        if (!dep || dep.metadata.status !== ProcessStatus.COMPLETED) {
          throw new Error(`Dependency not met: ${depId}`);
        }
      }
    }

    this.updateProcessStatus(processId, ProcessStatus.RUNNING);
    process.metadata.startedAt = new Date();

    this.addLog(processId, 'info', 'Process started', 'ProcessManager');
    this.startResourceMonitoring(processId);

    // Store the executor for potential cancellation
    if (executor) {
      this.activeExecutions.set(processId, executor);
    }

    this.emitEvent('status_change', processId, { status: ProcessStatus.RUNNING });
    this.logger.log(`Started process: ${processId}`);
  }

  async pauseProcess(processId: string): Promise<void> {
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process not found: ${processId}`);
    }

    if (process.metadata.status !== ProcessStatus.RUNNING) {
      throw new Error(`Process cannot be paused from status: ${process.metadata.status}`);
    }

    this.updateProcessStatus(processId, ProcessStatus.PAUSED);
    this.addLog(processId, 'info', 'Process paused', 'ProcessManager');
    this.stopResourceMonitoring(processId);

    this.emitEvent('status_change', processId, { status: ProcessStatus.PAUSED });
    this.logger.log(`Paused process: ${processId}`);
  }

  async resumeProcess(processId: string): Promise<void> {
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process not found: ${processId}`);
    }

    if (process.metadata.status !== ProcessStatus.PAUSED) {
      throw new Error(`Process cannot be resumed from status: ${process.metadata.status}`);
    }

    this.updateProcessStatus(processId, ProcessStatus.RUNNING);
    this.addLog(processId, 'info', 'Process resumed', 'ProcessManager');
    this.startResourceMonitoring(processId);

    this.emitEvent('status_change', processId, { status: ProcessStatus.RUNNING });
    this.logger.log(`Resumed process: ${processId}`);
  }

  async stopProcess(processId: string, force = false): Promise<void> {
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process not found: ${processId}`);
    }

    if (process.metadata.status === ProcessStatus.COMPLETED || 
        process.metadata.status === ProcessStatus.FAILED ||
        process.metadata.status === ProcessStatus.CANCELLED) {
      return; // Already stopped
    }

    // Cancel active execution if it exists
    const executor = this.activeExecutions.get(processId);
    if (executor && typeof executor.cancel === 'function') {
      try {
        await executor.cancel(force);
      } catch (error) {
        this.logger.warn(`Error cancelling executor for process ${processId}: ${error.message}`);
      }
    }

    this.updateProcessStatus(processId, ProcessStatus.CANCELLED);
    process.metadata.completedAt = new Date();
    this.stopResourceMonitoring(processId);
    this.activeExecutions.delete(processId);

    this.addLog(processId, 'info', force ? 'Process force stopped' : 'Process stopped', 'ProcessManager');
    this.emitEvent('status_change', processId, { status: ProcessStatus.CANCELLED });
    this.logger.log(`Stopped process: ${processId}`);
  }

  async completeProcess(processId: string, output?: ProcessOutput): Promise<void> {
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process not found: ${processId}`);
    }

    this.updateProcessStatus(processId, ProcessStatus.COMPLETED);
    process.metadata.completedAt = new Date();
    process.output = output;
    this.stopResourceMonitoring(processId);
    this.activeExecutions.delete(processId);

    this.addLog(processId, 'info', 'Process completed successfully', 'ProcessManager');
    this.emitEvent('completion', processId, { output });
    this.logger.log(`Completed process: ${processId}`);
  }

  async failProcess(processId: string, error: ProcessError): Promise<void> {
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process not found: ${processId}`);
    }

    this.updateProcessStatus(processId, ProcessStatus.FAILED);
    process.metadata.completedAt = new Date();
    process.error = error;
    this.stopResourceMonitoring(processId);
    this.activeExecutions.delete(processId);

    this.addLog(processId, 'error', `Process failed: ${error.message}`, 'ProcessManager');
    this.emitEvent('error', processId, { error });
    this.logger.error(`Failed process: ${processId} - ${error.message}`);
  }

  getProcess(processId: string): LongRunningProcess | undefined {
    return this.processes.get(processId);
  }

  getProcesses(filter?: ProcessFilter): LongRunningProcess[] {
    let processes = Array.from(this.processes.values());

    if (filter) {
      if (filter.status?.length) {
        processes = processes.filter(p => filter.status!.includes(p.metadata.status));
      }
      if (filter.type?.length) {
        processes = processes.filter(p => filter.type!.includes(p.metadata.type));
      }
      if (filter.priority?.length) {
        processes = processes.filter(p => filter.priority!.includes(p.metadata.priority));
      }
      if (filter.ownerId) {
        processes = processes.filter(p => p.metadata.ownerId === filter.ownerId);
      }
      if (filter.tags?.length) {
        processes = processes.filter(p => 
          filter.tags!.some(tag => p.metadata.tags.includes(tag))
        );
      }
      if (filter.createdAfter) {
        processes = processes.filter(p => p.metadata.createdAt >= filter.createdAfter!);
      }
      if (filter.createdBefore) {
        processes = processes.filter(p => p.metadata.createdAt <= filter.createdBefore!);
      }

      // Sorting
      if (filter.sortBy) {
        processes.sort((a, b) => {
          let aVal: any, bVal: any;
          switch (filter.sortBy) {
            case 'createdAt':
              aVal = a.metadata.createdAt;
              bVal = b.metadata.createdAt;
              break;
            case 'updatedAt':
              aVal = a.metadata.updatedAt;
              bVal = b.metadata.updatedAt;
              break;
            case 'priority':
              const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
              aVal = priorityOrder[a.metadata.priority as keyof typeof priorityOrder];
              bVal = priorityOrder[b.metadata.priority as keyof typeof priorityOrder];
              break;
            case 'name':
              aVal = a.metadata.name;
              bVal = b.metadata.name;
              break;
            default:
              aVal = a.metadata.createdAt;
              bVal = b.metadata.createdAt;
          }
          
          if (filter.sortOrder === 'desc') {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
          } else {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          }
        });
      }

      // Pagination
      if (filter.offset) {
        processes = processes.slice(filter.offset);
      }
      if (filter.limit) {
        processes = processes.slice(0, filter.limit);
      }
    }

    return processes;
  }

  getProcessStats(): ProcessStats {
    const processes = Array.from(this.processes.values());
    
    const byStatus = processes.reduce((acc, p) => {
      acc[p.metadata.status] = (acc[p.metadata.status] || 0) + 1;
      return acc;
    }, {} as Record<ProcessStatus, number>);

    const byType = processes.reduce((acc, p) => {
      acc[p.metadata.type] = (acc[p.metadata.type] || 0) + 1;
      return acc;
    }, {} as Record<ProcessType, number>);

    const byPriority = processes.reduce((acc, p) => {
      acc[p.metadata.priority] = (acc[p.metadata.priority] || 0) + 1;
      return acc;
    }, {} as Record<ProcessPriority, number>);

    const completedProcesses = processes.filter(p => 
      p.metadata.status === ProcessStatus.COMPLETED && 
      p.metadata.startedAt && 
      p.metadata.completedAt
    );

    const averageExecutionTime = completedProcesses.length > 0
      ? completedProcesses.reduce((sum, p) => {
          const duration = p.metadata.completedAt!.getTime() - p.metadata.startedAt!.getTime();
          return sum + duration;
        }, 0) / completedProcesses.length
      : 0;

    const totalResourceUsage = processes.reduce(
      (acc, p) => {
        const latest = p.resourceUsage?.[p.resourceUsage.length - 1];
        if (latest) {
          acc.cpu += latest.cpu;
          acc.memory += latest.memory;
          acc.disk += latest.disk;
        }
        return acc;
      },
      { cpu: 0, memory: 0, disk: 0 }
    );

    return {
      total: processes.length,
      byStatus,
      byType,
      byPriority,
      averageExecutionTime,
      totalResourceUsage,
    };
  }

  updateProgress(processId: string, progress: ProcessProgress): void {
    const process = this.processes.get(processId);
    if (process) {
      process.progress = progress;
      process.metadata.updatedAt = new Date();
      this.emitEvent('progress_update', processId, progress);
    }
  }

  addLog(processId: string, level: ProcessLog['level'], message: string, source: string, context?: Record<string, any>): void {
    const process = this.processes.get(processId);
    if (process) {
      const log: ProcessLog = {
        id: uuidv4(),
        timestamp: new Date(),
        level,
        message,
        context,
        source,
      };
      process.logs.push(log);
      
      // Keep only recent logs to prevent memory issues
      if (process.logs.length > 1000) {
        process.logs = process.logs.slice(-500);
      }

      process.metadata.updatedAt = new Date();
      this.emitEvent('log_entry', processId, log);
    }
  }

  private updateProcess(processId: string, updates: Partial<LongRunningProcess>): void {
    const process = this.processes.get(processId);
    if (process) {
      Object.assign(process, updates);
      process.metadata.updatedAt = new Date();
    }
  }

  private updateProcessStatus(processId: string, status: ProcessStatus): void {
    const process = this.processes.get(processId);
    if (process) {
      process.metadata.status = status;
      process.metadata.updatedAt = new Date();
    }
  }

  private startResourceMonitoring(processId: string): void {
    if (this.resourceMonitors.has(processId)) {
      return; // Already monitoring
    }

    const interval = setInterval(async () => {
      try {
        const usage = await this.getProcessResourceUsage(processId);
        const process = this.processes.get(processId);
        if (process) {
          if (!process.resourceUsage) {
            process.resourceUsage = [];
          }
          process.resourceUsage.push(usage);
          
          // Keep only recent usage data
          if (process.resourceUsage.length > 100) {
            process.resourceUsage = process.resourceUsage.slice(-50);
          }

          this.emitEvent('resource_update', processId, usage);
        }
      } catch (error) {
        this.logger.warn(`Error monitoring resources for process ${processId}: ${error.message}`);
      }
    }, 5000); // Every 5 seconds

    this.resourceMonitors.set(processId, interval);
  }

  private stopResourceMonitoring(processId: string): void {
    const interval = this.resourceMonitors.get(processId);
    if (interval) {
      clearInterval(interval);
      this.resourceMonitors.delete(processId);
    }
  }

  private async getProcessResourceUsage(processId: string): Promise<ProcessResourceUsage> {
    // This is a simplified implementation. In a real scenario, you would
    // integrate with system monitoring tools or container metrics
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 1024,
      disk: Math.random() * 2048,
      network: {
        bytesIn: Math.random() * 1000000,
        bytesOut: Math.random() * 1000000,
      },
      timestamp: new Date(),
    };
  }

  private emitEvent(type: ProcessEvent['type'], processId: string, data: any): void {
    const event: ProcessEvent = {
      type,
      processId,
      data,
      timestamp: new Date(),
    };
    this.eventEmitter.emit('process.event', event);
  }

  async cleanup(): Promise<void> {
    // Clean up resource monitors
    for (const interval of this.resourceMonitors.values()) {
      clearInterval(interval);
    }
    this.resourceMonitors.clear();

    // Cancel active executions
    for (const [processId, executor] of this.activeExecutions.entries()) {
      if (typeof executor.cancel === 'function') {
        try {
          await executor.cancel(true);
        } catch (error) {
          this.logger.warn(`Error cancelling executor for process ${processId}: ${error.message}`);
        }
      }
    }
    this.activeExecutions.clear();

    this.logger.log('ProcessManager cleanup completed');
  }
}