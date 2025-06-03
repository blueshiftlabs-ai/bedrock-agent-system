import { Logger } from '@nestjs/common';
import { BedrockMcpClient } from '@integrations/bedrock/bedrock-mcp.client';

export abstract class BaseAgent {
  protected readonly logger: Logger;
  protected client: BedrockMcpClient;
  protected name: string;

  constructor(client: BedrockMcpClient, name: string) {
    this.client = client;
    this.name = name;
    this.logger = new Logger(`${name}Agent`);
  }

  public async execute(prompt: string, options?: any): Promise<any> {
    this.logger.log(`Executing ${this.name} agent`);
    
    try {
      const result = await this.processRequest(prompt, options);
      this.logger.log(`${this.name} agent completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Error in ${this.name} agent: ${error.message}`);
      throw error;
    }
  }

  protected abstract processRequest(prompt: string, options?: any): Promise<any>;
  protected abstract getSystemPrompt(): string;

  protected buildPrompt(userRequest: string, context?: any): string {
    const systemPrompt = this.getSystemPrompt();
    let prompt = `${systemPrompt}\n\nUser Request: ${userRequest}`;
    
    if (context) {
      prompt += `\n\nContext: ${JSON.stringify(context, null, 2)}`;
    }
    
    return prompt;
  }
}
