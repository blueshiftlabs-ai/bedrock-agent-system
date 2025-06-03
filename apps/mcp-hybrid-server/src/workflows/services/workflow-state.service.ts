import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBService } from '../../aws/dynamodb.service';
import { BaseState } from '../states/base-state';
import { getErrorMessage } from '@/common/utils/error-utils';

@Injectable()
export class WorkflowStateService {
  private readonly logger = new Logger(WorkflowStateService.name);

  constructor(private readonly dynamoService: DynamoDBService) {}

  async saveWorkflowState(workflowId: string, state: BaseState): Promise<void> {
    try {
      await this.dynamoService.putItem('WorkflowState', {
        workflowId,
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
      const item = await this.dynamoService.getItem('WorkflowState', { workflowId });
      return item ? JSON.parse(item.state) : null;
    } catch (error) {
      this.logger.error(`Error getting workflow state: ${getErrorMessage(error)}`);
      return null;
    }
  }

  async saveCheckpoint(workflowId: string, stage: string, data: any): Promise<void> {
    try {
      await this.dynamoService.putItem('WorkflowCheckpoints', {
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

  async getCheckpoints(workflowId: string): Promise<any[]> {
    try {
      return await this.dynamoService.queryItems('WorkflowCheckpoints', {
        KeyConditionExpression: 'workflowId = :workflowId',
        ExpressionAttributeValues: {
          ':workflowId': workflowId,
        },
      });
    } catch (error) {
      this.logger.error(`Error getting checkpoints: ${getErrorMessage(error)}`);
      return [];
    }
  }
}
