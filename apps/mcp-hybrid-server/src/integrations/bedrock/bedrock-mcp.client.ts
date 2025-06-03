import { Injectable, Logger } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';

/**
 * Bedrock MCP Client for AI model integrations
 */
interface AnthropicToolInputSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: AnthropicToolInputSchema;
}

export interface AnthropicToolChoice {
  type: 'auto' | 'any' | 'tool';
  name?: string; // Required if type is 'tool'
}

export interface InvokeModelOptions {
  modelId?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: AnthropicTool[];
  toolChoice?: AnthropicToolChoice;
  // This was in the original agent call, but 'tools' and 'toolChoice' are more specific for Messages API
  includeTools?: boolean; 
}

@Injectable()
export class BedrockMcpClient {
  private readonly logger = new Logger(BedrockMcpClient.name);
  private readonly bedrockClient: BedrockRuntimeClient;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.bedrockClient = new BedrockRuntimeClient({ region });
    this.logger.log(`BedrockMcpClient initialized for region: ${region}`);
  }

  /**
   * Invoke a Bedrock model with the given prompt
   */
  async invoke(prompt: string, modelId?: string): Promise<any> {
    this.logger.debug(`Invoking Bedrock model: ${modelId || 'default'}`);
    
    // TODO: Implement actual Bedrock invocation
    return {
      response: `Mock response for prompt: ${prompt}`,
      modelId: modelId || 'anthropic.claude-v2',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Stream response from Bedrock model
   */
  async stream(prompt: string, modelId?: string): Promise<AsyncIterable<any>> {
    this.logger.debug(`Streaming from Bedrock model: ${modelId || 'default'}`);
    
    // TODO: Implement actual streaming
    async function* mockStream() {
      const words = prompt.split(' ');
      for (const word of words) {
        yield { token: word, done: false };
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      yield { token: '', done: true };
    }
    
    return mockStream();
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    return [
      'anthropic.claude-v2',
      'anthropic.claude-instant-v1',
      'amazon.titan-text-express-v1',
    ];
  }

  /**
   * Invoke a Bedrock model (specifically Anthropic Claude 3 via Messages API) with the given prompt and options.
   * @param promptContent The main content of the user's message.
   * @param options Configuration options for the model invocation.
   * @returns The parsed JSON response from the model.
   */
  async invokeModel(promptContent: string, options?: InvokeModelOptions): Promise<any> {
    const modelId = options?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
    const maxTokens = options?.maxTokens || 4096;
    const temperature = options?.temperature !== undefined ? options.temperature : 0.1;

    this.logger.debug(
      `Invoking Bedrock model: ${modelId} with prompt and options: ${JSON.stringify(options)}`,
    );

    const messages = [{ role: 'user' as const, content: promptContent }];

    const requestBody: any = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      messages: messages,
    };

    if (options?.systemPrompt) {
      requestBody.system = options.systemPrompt;
    }
    if (options?.temperature !== undefined) {
      requestBody.temperature = temperature;
    }
    if (options?.tools && options.tools.length > 0) {
      requestBody.tools = options.tools;
      if (options.toolChoice) {
        requestBody.tool_choice = options.toolChoice;
      }
    } else if (options?.includeTools) {
      this.logger.warn(
        "'includeTools: true' was passed, but no specific 'tools' array was provided. " +
        "To use tools with Claude 3 Messages API, define and pass them in the 'tools' option."
      );
      // If you have a default set of tools or a way to infer them, that logic could go here.
    }

    const commandInput: InvokeModelCommandInput = {
      modelId: modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    };

    try {
      const command = new InvokeModelCommand(commandInput);
      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      this.logger.debug('Bedrock model invocation successful.');
      return responseBody;
    } catch (error) {
      this.logger.error(`Error invoking Bedrock model ${modelId}:`, error);
      throw error;
    }
  }
}