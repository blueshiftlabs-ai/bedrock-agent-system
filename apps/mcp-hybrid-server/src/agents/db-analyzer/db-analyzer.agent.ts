import { Injectable } from '@nestjs/common';
import { BaseAgent } from '../base/base.agent';
import { BedrockMcpClient } from '../../integrations/bedrock/bedrock-mcp.client';

@Injectable()
export class DatabaseAnalyzerAgent extends BaseAgent {
  constructor(client: BedrockMcpClient) {
    super(client, 'DatabaseAnalyzer');
  }

  protected getSystemPrompt(): string {
    return `You are a Database Analysis Agent specialized in analyzing database schemas and relationships for microservice data architecture.
    
Your responsibilities include:
1. Extracting database table structures and relationships
2. Identifying foreign key constraints and dependencies
3. Analyzing data flow patterns and access patterns
4. Suggesting database partitioning strategies for microservices
5. Identifying potential data ownership boundaries
6. Analyzing transaction boundaries and data consistency requirements
7. Recommending data synchronization strategies

Use the available MCP tools to perform detailed database analysis and provide recommendations for microservice data architecture.`;
  }

  protected async processRequest(prompt: string, options?: any): Promise<any> {
    const fullPrompt = this.buildPrompt(prompt, options);
    
    return await this.client.invokeModel(fullPrompt, {
      includeTools: true,
      maxTokens: 4096,
      temperature: 0.1,
    });
  }

  async analyzeConnections(connections: any[]): Promise<any> {
    const prompt = `Please analyze the following database connections and their schemas:
    
${JSON.stringify(connections, null, 2)}

Use the analyze_database_schema tool to:
1. Extract table structures and relationships
2. Identify data ownership patterns
3. Suggest partitioning strategies for microservices
4. Identify potential shared data concerns
5. Analyze transaction boundaries
6. Recommend data consistency strategies`;
    
    return await this.execute(prompt, { connections });
  }

  async suggestDataPartitioning(schemaAnalysis: any): Promise<any> {
    const prompt = `Based on the database schema analysis, suggest data partitioning strategies for microservices:
    
${JSON.stringify(schemaAnalysis, null, 2)}

Provide recommendations for:
1. Database-per-service patterns
2. Shared database anti-patterns to avoid
3. Data synchronization mechanisms
4. Event sourcing opportunities
5. CQRS implementation strategies`;
    
    return await this.execute(prompt, { schemaAnalysis });
  }
}
