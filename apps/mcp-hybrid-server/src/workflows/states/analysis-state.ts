import { BaseState } from './base-state';

export interface CodeAnalysisState extends BaseState {
  filePath: string;
  analysisStage: 'start' | 'code_analyzed' | 'db_analyzed' | 'knowledge_updated' | 'documentation_generated' | 'completed' | 'error';
  codeAnalysisResult?: any;
  databaseAnalysisResult?: any;
  knowledgeGraphUpdates?: any;
  documentation?: any;
  currentAgent?: string;
  toolResults?: Record<string, any>;
  error?: string;
  metadata?: Record<string, any>;
  retryCount?: number;
}

export interface RepositoryAnalysisState extends BaseState {
  repositoryUrl: string;
  analysisStage: string;
  clonedPath?: string;
  fileAnalysisResults?: any[];
  architectureAnalysis?: any;
  dependencyGraph?: any;
  microserviceRecommendations?: any;
  migrationPlan?: any;
}
