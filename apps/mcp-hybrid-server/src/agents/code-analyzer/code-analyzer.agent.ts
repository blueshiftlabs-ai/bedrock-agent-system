import { Injectable } from '@nestjs/common';
import { BaseAgent } from '../base/base.agent';
import { BedrockMcpClient } from '@integrations/bedrock/bedrock-mcp.client';

@Injectable()
export class CodeAnalyzerAgent extends BaseAgent {
  constructor(client: BedrockMcpClient) {
    super(client, 'CodeAnalyzer');
  }

  protected getSystemPrompt(): string {
    return `You are a Code Analysis Agent specialized in analyzing source code files for microservice transformation.
    
Your capabilities include:
1. Extracting functions, classes, and their relationships
2. Identifying import dependencies and coupling
3. Calculating code complexity metrics
4. Suggesting potential microservice boundaries
5. Identifying patterns, anti-patterns, and code smells
6. Analyzing data flow and business logic separation

Always use the available MCP tools to perform detailed analysis and provide structured, actionable insights for monolith-to-microservice transformation.`;
  }

  protected async processRequest(prompt: string, options?: any): Promise<any> {
    const fullPrompt = this.buildPrompt(prompt, options);
    
    return await this.client.invokeModel(fullPrompt, {
      includeTools: true,
      maxTokens: 4096,
      temperature: 0.1,
    });
  }

  async analyzeFile(filePath: string, options?: any): Promise<any> {
    const prompt = `Please analyze the code file at "${filePath}" using the analyze_code_file tool.
    
    Focus on:
    1. Function and class extraction with detailed analysis
    2. Dependency analysis and coupling metrics
    3. Complexity metrics and code quality assessment
    4. Potential refactoring opportunities for microservices
    5. Business logic identification and separation concerns
    6. Data access pattern analysis
    
    Options: ${JSON.stringify(options || {}, null, 2)}`;
    
    return await this.execute(prompt, options);
  }

  async analyzeDependencies(analysisResult: any): Promise<any> {
    const prompt = `Based on the code analysis results, please analyze the dependency structure and suggest microservice boundaries:
    
    ${JSON.stringify(analysisResult, null, 2)}
    
    Provide recommendations for:
    1. Service boundary identification
    2. Shared dependency management
    3. API surface area definition
    4. Data ownership boundaries`;
    
    return await this.execute(prompt);
  }
}
