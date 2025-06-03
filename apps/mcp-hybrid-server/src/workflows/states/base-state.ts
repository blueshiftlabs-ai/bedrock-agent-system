export interface BaseState {
  workflowId: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
    agentId?: string;
  }>;
  startTime: number;
  lastUpdated: number;
  checkpoints?: Array<{
    stage: string;
    timestamp: number;
    data: any;
  }>;
}
