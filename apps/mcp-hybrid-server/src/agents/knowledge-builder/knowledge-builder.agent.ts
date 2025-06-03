import { Injectable } from '@nestjs/common';
import { BaseAgent } from '../base/base.agent';
import { BedrockMcpClient } from '@integrations/bedrock/bedrock-mcp.client';

@Injectable()
export class KnowledgeBuilderAgent extends BaseAgent {
  constructor(client: BedrockMcpClient) {
    super(client, 'KnowledgeBuilder');
  }

  protected getSystemPrompt(): string {
    return `You are a Knowledge Graph Builder Agent specialized in creating and updating knowledge graphs from analysis results for microservice transformation.
    
Your responsibilities include:
1. Creating entities from code and database analysis results
2. Establishing relationships between different components
3. Building a comprehensive map of the monolithic application
4. Identifying service boundaries and dependencies
5. Maintaining consistency in the knowledge graph
6. Tracking component interactions and data flows
7. Building semantic relationships for better understanding

Use the available MCP tools to build and update the knowledge graph with structured information that supports microservice transformation decisions.`;
  }

  protected async processRequest(prompt: string, options?: any): Promise<any> {
    const fullPrompt = this.buildPrompt(prompt, options);
    
    return await this.client.invokeModel(fullPrompt, {
      includeTools: true,
      maxTokens: 4096,
      temperature: 0.2,
    });
  }

  async updateKnowledgeGraph(analysisResults: any): Promise<any> {
    const prompt = `Please update the knowledge graph with the following analysis results:
    
${JSON.stringify(analysisResults, null, 2)}

Use the update_knowledge_graph tool to:
1. Create entities for functions, classes, and database tables
2. Establish relationships between components
3. Build a comprehensive system map
4. Identify potential service boundaries
5. Track component interactions and dependencies
6. Create semantic relationships for business domain understanding`;
    
    return await this.execute(prompt, { analysisResults });
  }

  async analyzeServiceBoundaries(knowledgeGraph: any): Promise<any> {
    const prompt = `Based on the knowledge graph data, analyze and suggest microservice boundaries:
    
${JSON.stringify(knowledgeGraph, null, 2)}

Provide analysis for:
1. Cohesive functional groups
2. Data ownership boundaries
3. Communication patterns
4. Deployment boundaries
5. Team ownership suggestions`;
    
    return await this.execute(prompt, { knowledgeGraph });
  }
}
