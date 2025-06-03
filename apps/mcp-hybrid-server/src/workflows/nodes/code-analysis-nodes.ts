import { Injectable, Logger } from '@nestjs/common';
import { CodeAnalysisState } from '../states/analysis-state';
import { CodeAnalyzerAgent } from '@agents/code-analyzer/code-analyzer.agent';
import { DatabaseAnalyzerAgent } from '@agents/db-analyzer/db-analyzer.agent';
import { KnowledgeBuilderAgent } from '@agents/knowledge-builder/knowledge-builder.agent';
import { DocumentationGeneratorAgent } from '@agents/documentation-generator/documentation-generator.agent';
import { getErrorMessage } from '@/common/utils/error-utils';

@Injectable()
export class CodeAnalysisNodes {
  private readonly logger = new Logger(CodeAnalysisNodes.name);

  constructor(
    private readonly codeAnalyzerAgent: CodeAnalyzerAgent,
    private readonly dbAnalyzerAgent: DatabaseAnalyzerAgent,
    private readonly knowledgeBuilderAgent: KnowledgeBuilderAgent,
    private readonly documentationGeneratorAgent: DocumentationGeneratorAgent,
  ) {}

  async analyzeCode(state: CodeAnalysisState): Promise<CodeAnalysisState> {
    try {
      this.logger.log(`Analyzing code file: ${state.filePath}`);
      
      const result = await this.codeAnalyzerAgent.analyzeFile(state.filePath, {
        includeMetrics: true,
        extractDependencies: true,
      });
      
      return {
        ...state,
        analysisStage: 'code_analyzed',
        codeAnalysisResult: result,
        currentAgent: 'code_analyzer',
        lastUpdated: Date.now(),
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            content: `Code analysis completed for ${state.filePath}. Found ${result.functions?.length || 0} functions and ${result.classes?.length || 0} classes.`,
            timestamp: new Date().toISOString(),
            agentId: 'code_analyzer',
          }
        ],
        toolResults: {
          ...state.toolResults,
          codeAnalysis: result
        }
      };
    } catch (error: any) {
      this.logger.error('Error in code analysis:', error);
      return {
        ...state,
        analysisStage: 'error',
        error: `Code analysis failed: ${getErrorMessage(error)}`,
        lastUpdated: Date.now(),
      };
    }
  }

  async analyzeDatabaseConnections(state: CodeAnalysisState): Promise<CodeAnalysisState> {
    try {
      this.logger.log('Analyzing database connections from code analysis results');
      
      const dbConnections = this.extractDatabaseConnections(state.codeAnalysisResult);
      
      if (dbConnections.length === 0) {
        return {
          ...state,
          analysisStage: 'knowledge_updated', // Skip DB analysis
          lastUpdated: Date.now(),
          messages: [
            ...state.messages,
            {
              role: 'assistant',
              content: 'No database connections found, skipping database analysis.',
              timestamp: new Date().toISOString(),
              agentId: 'db_analyzer',
            }
          ]
        };
      }
      
      const result = await this.dbAnalyzerAgent.analyzeConnections(dbConnections);
      
      return {
        ...state,
        analysisStage: 'db_analyzed',
        databaseAnalysisResult: result,
        currentAgent: 'db_analyzer',
        lastUpdated: Date.now(),
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            content: `Database analysis completed. Found ${result.tables?.length || 0} tables and ${result.relationships?.length || 0} relationships.`,
            timestamp: new Date().toISOString(),
            agentId: 'db_analyzer',
          }
        ],
        toolResults: {
          ...state.toolResults,
          databaseAnalysis: result
        }
      };
    } catch (error) {
      this.logger.error('Error in database analysis:', error);
      return {
        ...state,
        analysisStage: 'error',
        error: `Database analysis failed: ${getErrorMessage(error)}`,
        lastUpdated: Date.now(),
      };
    }
  }

  async updateKnowledgeGraph(state: CodeAnalysisState): Promise<CodeAnalysisState> {
    try {
      this.logger.log('Updating knowledge graph with analysis results');
      
      const analysisData = {
        codeAnalysis: state.codeAnalysisResult,
        databaseAnalysis: state.databaseAnalysisResult,
        source: state.filePath,
      };
      
      const result = await this.knowledgeBuilderAgent.updateKnowledgeGraph(analysisData);
      
      return {
        ...state,
        analysisStage: 'knowledge_updated',
        knowledgeGraphUpdates: result,
        currentAgent: 'knowledge_builder',
        lastUpdated: Date.now(),
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            content: `Knowledge graph updated with ${result.entitiesAdded || 0} new entities and ${result.relationshipsAdded || 0} new relationships.`,
            timestamp: new Date().toISOString(),
            agentId: 'knowledge_builder',
          }
        ],
        toolResults: {
          ...state.toolResults,
          knowledgeGraphUpdate: result
        }
      };
    } catch (error) {
      this.logger.error('Error updating knowledge graph:', error);
      return {
        ...state,
        analysisStage: 'error',
        error: `Knowledge graph update failed: ${getErrorMessage(error)}`,
        lastUpdated: Date.now(),
      };
    }
  }

  async generateDocumentation(state: CodeAnalysisState): Promise<CodeAnalysisState> {
    try {
      this.logger.log('Generating documentation from analysis results');
      
      const analysisResults = {
        codeAnalysis: state.codeAnalysisResult,
        databaseAnalysis: state.databaseAnalysisResult,
        knowledgeGraph: state.knowledgeGraphUpdates,
        filePath: state.filePath,
      };
      
      const result = await this.documentationGeneratorAgent.generateDocumentation(analysisResults);
      
      return {
        ...state,
        analysisStage: 'documentation_generated',
        documentation: result,
        currentAgent: 'documentation_generator',
        lastUpdated: Date.now(),
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            content: 'Documentation generated successfully.',
            timestamp: new Date().toISOString(),
            agentId: 'documentation_generator',
          }
        ],
        toolResults: {
          ...state.toolResults,
          documentation: result
        }
      };
    } catch (error) {
      this.logger.error('Error generating documentation:', error);
      return {
        ...state,
        analysisStage: 'error',
        error: `Documentation generation failed: ${getErrorMessage(error)}`,
        lastUpdated: Date.now(),
      };
    }
  }

  private extractDatabaseConnections(codeAnalysisResult: any): any[] {
    if (!codeAnalysisResult?.dependencies?.external) {
      return [];
    }
    
    const dbLibraries = [
      'mysql', 'mysql2', 'pg', 'postgresql', 'sequelize', 'typeorm', 'mongodb',
      'mongoose', 'sqlite', 'sqlite3', 'prisma', 'knex', 'objection'
    ];
    
    return codeAnalysisResult.dependencies.external
      .filter((dep: string) => dbLibraries.some(lib => dep.includes(lib)))
      .map((dep: string) => ({
        type: this.determineDbType(dep),
        importPath: dep,
        confidence: 0.8
      }));
  }

  private determineDbType(importPath: string): string {
    if (importPath.includes('mysql')) return 'mysql';
    if (importPath.includes('pg') || importPath.includes('postgresql')) return 'postgresql';
    if (importPath.includes('mongodb') || importPath.includes('mongoose')) return 'mongodb';
    if (importPath.includes('sqlite')) return 'sqlite';
    if (importPath.includes('sequelize')) return 'sequelize';
    if (importPath.includes('typeorm')) return 'typeorm';
    if (importPath.includes('prisma')) return 'prisma';
    return 'unknown';
  }
}
