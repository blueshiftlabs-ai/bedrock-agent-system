import { Injectable } from '@nestjs/common';
import { BaseAgent } from '../base/base.agent';
import { BedrockMcpClient } from '../../integrations/bedrock/bedrock-mcp.client';

@Injectable()
export class DocumentationGeneratorAgent extends BaseAgent {
  constructor(client: BedrockMcpClient) {
    super(client, 'DocumentationGenerator');
  }

  protected getSystemPrompt(): string {
    return `You are a Documentation Generator Agent specialized in creating comprehensive documentation from analysis results for microservice transformation.
    
Your responsibilities include:
1. Generating structured documentation from code and database analysis
2. Creating microservice boundary recommendations with detailed rationale
3. Producing migration roadmaps and implementation strategies
4. Generating API specifications for proposed microservices
5. Creating architecture diagrams and explanations
6. Documenting data flow and integration patterns
7. Providing implementation guidelines and best practices

Use the available MCP tools to generate well-structured, actionable documentation that guides successful microservice transformation.`;
  }

  protected async processRequest(prompt: string, options?: any): Promise<any> {
    const fullPrompt = this.buildPrompt(prompt, options);
    
    return await this.client.invokeModel(fullPrompt, {
      includeTools: true,
      maxTokens: 4096,
      temperature: 0.3,
    });
  }

  async generateDocumentation(analysisResults: any): Promise<any> {
    const prompt = `Please generate comprehensive documentation based on the following analysis results:
    
${JSON.stringify(analysisResults, null, 2)}

Use the retrieve_documentation tool to create:
1. System overview and current architecture analysis
2. Microservice boundary recommendations with detailed rationale
3. Migration roadmap with phases and timelines
4. API specifications for proposed services
5. Data migration and synchronization strategies
6. Implementation guidelines and best practices
7. Risk assessment and mitigation strategies`;
    
    return await this.execute(prompt, { analysisResults });
  }

  async generateMigrationPlan(serviceDesign: any): Promise<any> {
    const prompt = `Based on the microservice design, generate a detailed migration plan:
    
${JSON.stringify(serviceDesign, null, 2)}

Create documentation for:
1. Phase-by-phase migration approach
2. Risk assessment and mitigation
3. Testing strategies
4. Deployment procedures
5. Rollback plans
6. Performance considerations`;
    
    return await this.execute(prompt, { serviceDesign });
  }
}
