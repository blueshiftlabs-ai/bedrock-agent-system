import { Injectable, Logger } from '@nestjs/common';
import { AwsService } from '../../aws/aws.service';
import { BaseState } from '../states/base-state';
import { getErrorMessage } from '@/common/utils/error-utils';

@Injectable()
export class WorkflowStateService {
  private readonly logger = new Logger(WorkflowStateService.name);

  constructor(private readonly awsService: AwsService) {}

  async saveWorkflowState(workflowId: string, state: BaseState): Promise<void> {
    try {
      await this.awsService.storeMemoryMetadata('WorkflowState', workflowId, {
        state: JSON.stringify(state),
        lastUpdated: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days TTL
      });
    } catch (error) {
      this.logger.error(`Error saving workflow state: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async getWorkflowState<T extends BaseState = BaseState>(workflowId: string): Promise<T | null> {
    try {
      const metadata = await this.awsService.getMemoryMetadata('WorkflowState', workflowId);
      return metadata ? JSON.parse(metadata.state) : null;
    } catch (error) {
      this.logger.error(`Error getting workflow state: ${getErrorMessage(error)}`);
      return null;
    }
  }

  async saveCheckpoint(workflowId: string, stage: string, data: any): Promise<void> {
    try {
      const checkpointId = `${workflowId}#${stage}#${Date.now()}`;
      await this.awsService.storeMemoryMetadata('WorkflowCheckpoints', checkpointId, {
        workflowId,
        stage,
        data: JSON.stringify(data),
        timestamp: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days TTL
      });
    } catch (error) {
      this.logger.error(`Error saving checkpoint: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async getCheckpoints(_workflowId: string): Promise<any[]> {
    try {
      // For now, return empty array - would need to implement query functionality
      // in AwsService for full checkpoint retrieval
      this.logger.warn('Checkpoint retrieval not fully implemented - returning empty array');
      return [];
    } catch (error) {
      this.logger.error(`Error getting checkpoints: ${getErrorMessage(error)}`);
      return [];
    }
  }
}
