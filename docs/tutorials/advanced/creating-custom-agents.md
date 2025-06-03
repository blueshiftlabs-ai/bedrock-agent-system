# Creating Custom Agents

## Overview

This guide walks you through creating custom agents for the MCP Hybrid Server. Agents are specialized AI components that extend the BaseAgent class to perform domain-specific analysis tasks.

## Prerequisites

- Understanding of TypeScript and NestJS
- Familiarity with the BaseAgent class
- Knowledge of AWS Bedrock integration

## Step 1: Define Your Agent's Purpose

Before coding, clearly define:
- What analysis will your agent perform?
- What inputs does it need?
- What outputs will it produce?
- Which AI model is most suitable?

## Step 2: Create the Agent Class

### Basic Structure

Create a new file in `src/agents/your-agent/your-agent.agent.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { BaseAgent } from '../base/base.agent';
import { BedrockService } from '../../integrations/bedrock/bedrock.service';

@Injectable()
export class YourCustomAgent extends BaseAgent {
  private readonly logger = new Logger(YourCustomAgent.name);

  constructor(private readonly bedrockService: BedrockService) {
    super('YourCustomAgent', bedrockService);
  }

  async execute(input: YourAgentInput): Promise<YourAgentOutput> {
    this.logger.log('Starting custom analysis');
    
    try {
      // Your agent logic here
      const prompt = this.buildPrompt(input);
      const response = await this.invokeModel(prompt);
      const result = this.parseResponse(response);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error('Analysis failed', error);
      throw error;
    }
  }

  private buildPrompt(input: YourAgentInput): string {
    return `
      Analyze the following data:
      ${JSON.stringify(input)}
      
      Provide a structured analysis including:
      1. Key insights
      2. Recommendations
      3. Risk factors
    `;
  }

  private parseResponse(response: any): any {
    // Parse and validate AI response
    return response;
  }
}
```

## Step 3: Define Input/Output Types

Create type definitions in `src/agents/your-agent/types.ts`:

```typescript
export interface YourAgentInput {
  data: string;
  context?: {
    projectType?: string;
    analysisDepth?: number;
    includeMetrics?: boolean;
  };
  options?: YourAgentOptions;
}

export interface YourAgentOptions {
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
  model?: string;
}

export interface YourAgentOutput {
  success: boolean;
  data: {
    summary: string;
    insights: Insight[];
    recommendations: Recommendation[];
    metrics?: Metrics;
  };
  metadata?: {
    processingTime: number;
    modelUsed: string;
    tokensConsumed: number;
  };
}

export interface Insight {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence?: string[];
}

export interface Recommendation {
  action: string;
  priority: number;
  estimatedImpact: string;
  implementation?: string;
}

export interface Metrics {
  [key: string]: number | string;
}
```

## Step 4: Implement Advanced Features

### Streaming Results

```typescript
async executeWithStream(
  input: YourAgentInput,
  onChunk: (chunk: any) => void
): Promise<YourAgentOutput> {
  const stream = await this.bedrockService.invokeModelWithStream({
    prompt: this.buildPrompt(input),
    onChunk: (chunk) => {
      const parsed = this.parseStreamChunk(chunk);
      onChunk(parsed);
    }
  });
  
  return this.finalizeStreamResults(stream);
}
```

### Caching

```typescript
import { CacheService } from '../../common/cache/cache.service';

@Injectable()
export class YourCustomAgent extends BaseAgent {
  constructor(
    private readonly bedrockService: BedrockService,
    private readonly cacheService: CacheService
  ) {
    super('YourCustomAgent', bedrockService);
  }

  async execute(input: YourAgentInput): Promise<YourAgentOutput> {
    const cacheKey = this.generateCacheKey(input);
    
    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.log('Returning cached result');
      return cached;
    }
    
    // Perform analysis
    const result = await this.performAnalysis(input);
    
    // Cache result
    await this.cacheService.set(cacheKey, result, 3600); // 1 hour
    
    return result;
  }
}
```

### Error Handling and Retry Logic

```typescript
import { retry } from 'rxjs/operators';
import { from } from 'rxjs';

async executeWithRetry(input: YourAgentInput): Promise<YourAgentOutput> {
  const options = input.options || {};
  const maxRetries = options.maxRetries || 3;
  
  return from(this.performAnalysis(input))
    .pipe(
      retry({
        count: maxRetries,
        delay: (error, retryCount) => {
          this.logger.warn(`Retry attempt ${retryCount} after error:`, error);
          return retryCount * 1000; // Exponential backoff
        }
      })
    )
    .toPromise();
}
```

## Step 5: Register the Agent

### Update Agent Module

Add your agent to `src/agents/agent.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { YourCustomAgent } from './your-agent/your-agent.agent';

@Module({
  imports: [BedrockModule, CacheModule],
  providers: [
    // Existing agents...
    YourCustomAgent,
  ],
  exports: [
    // Existing agents...
    YourCustomAgent,
  ],
})
export class AgentModule {}
```

### Create Agent Controller (Optional)

For direct API access to your agent:

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { YourCustomAgent } from './your-agent.agent';

@ApiTags('agents')
@Controller('agents/your-custom')
export class YourCustomAgentController {
  constructor(private readonly agent: YourCustomAgent) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Perform custom analysis' })
  async analyze(@Body() input: YourAgentInput): Promise<YourAgentOutput> {
    return this.agent.execute(input);
  }
}
```

## Step 6: Write Tests

### Unit Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { YourCustomAgent } from './your-agent.agent';
import { BedrockService } from '../../integrations/bedrock/bedrock.service';

describe('YourCustomAgent', () => {
  let agent: YourCustomAgent;
  let bedrockService: jest.Mocked<BedrockService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YourCustomAgent,
        {
          provide: BedrockService,
          useValue: {
            invokeModel: jest.fn(),
          },
        },
      ],
    }).compile();

    agent = module.get<YourCustomAgent>(YourCustomAgent);
    bedrockService = module.get(BedrockService);
  });

  describe('execute', () => {
    it('should analyze input successfully', async () => {
      const input: YourAgentInput = {
        data: 'test data',
        context: { projectType: 'web' },
      };

      bedrockService.invokeModel.mockResolvedValue({
        response: 'AI analysis result',
      });

      const result = await agent.execute(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(bedrockService.invokeModel).toHaveBeenCalledWith(
        expect.stringContaining('test data')
      );
    });

    it('should handle errors gracefully', async () => {
      bedrockService.invokeModel.mockRejectedValue(
        new Error('AI service unavailable')
      );

      await expect(agent.execute({ data: 'test' }))
        .rejects.toThrow('AI service unavailable');
    });
  });
});
```

### Integration Tests

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('YourCustomAgent Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should perform analysis via API', async () => {
    const response = await request(app.getHttpServer())
      .post('/agents/your-custom/analyze')
      .send({
        data: 'integration test data',
        context: { analysisDepth: 3 },
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.insights).toBeInstanceOf(Array);
  });
});
```

## Step 7: Add to Workflows

Integrate your agent into LangGraph workflows:

```typescript
import { StateGraph } from '@langchain/langgraph';
import { YourCustomAgent } from '../agents/your-agent/your-agent.agent';

export function createCustomWorkflow(agent: YourCustomAgent) {
  const workflow = new StateGraph({
    channels: {
      input: null,
      customAnalysis: null,
      output: null,
    },
  });

  // Add your agent as a node
  workflow.addNode('customAnalysis', async (state) => {
    const result = await agent.execute(state.input);
    return { customAnalysis: result };
  });

  // Define edges
  workflow.addEdge('START', 'customAnalysis');
  workflow.addEdge('customAnalysis', 'END');

  return workflow.compile();
}
```

## Best Practices

### 1. Prompt Engineering

```typescript
private buildPrompt(input: YourAgentInput): string {
  return `
    You are an expert analyst specializing in ${input.context?.projectType || 'general'} projects.
    
    Task: Analyze the provided data and generate actionable insights.
    
    Data:
    ${JSON.stringify(input.data, null, 2)}
    
    Requirements:
    1. Identify patterns and anomalies
    2. Assess risks and opportunities
    3. Provide specific, actionable recommendations
    
    Output format:
    {
      "insights": [...],
      "recommendations": [...],
      "summary": "..."
    }
  `;
}
```

### 2. Response Validation

```typescript
import { z } from 'zod';

const ResponseSchema = z.object({
  insights: z.array(z.object({
    type: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    description: z.string(),
  })),
  recommendations: z.array(z.object({
    action: z.string(),
    priority: z.number(),
  })),
  summary: z.string(),
});

private parseResponse(response: any): any {
  try {
    const parsed = JSON.parse(response);
    return ResponseSchema.parse(parsed);
  } catch (error) {
    this.logger.error('Invalid response format', error);
    throw new Error('Failed to parse AI response');
  }
}
```

### 3. Performance Monitoring

```typescript
import { PerformanceObserver } from 'perf_hooks';

async execute(input: YourAgentInput): Promise<YourAgentOutput> {
  const startTime = Date.now();
  const metrics = {
    promptTokens: 0,
    completionTokens: 0,
  };

  try {
    const result = await this.performAnalysis(input);
    
    const processingTime = Date.now() - startTime;
    this.logger.log(`Analysis completed in ${processingTime}ms`);
    
    return {
      ...result,
      metadata: {
        processingTime,
        modelUsed: this.getModelId(),
        tokensConsumed: metrics.promptTokens + metrics.completionTokens,
      },
    };
  } catch (error) {
    this.logger.error('Analysis failed', error);
    throw error;
  }
}
```

## Common Patterns

### Multi-Model Analysis

```typescript
async executeMultiModel(input: YourAgentInput): Promise<YourAgentOutput> {
  const models = ['claude-3-sonnet', 'claude-3-haiku'];
  const results = await Promise.all(
    models.map(model => 
      this.invokeModel(this.buildPrompt(input), { model })
    )
  );
  
  return this.consolidateResults(results);
}
```

### Contextual Memory

```typescript
import { MemoryService } from '../../memory/memory.service';

constructor(
  private readonly bedrockService: BedrockService,
  private readonly memoryService: MemoryService
) {
  super('YourCustomAgent', bedrockService);
}

async executeWithContext(
  input: YourAgentInput,
  sessionId: string
): Promise<YourAgentOutput> {
  // Retrieve context
  const context = await this.memoryService.getContext(sessionId);
  
  // Include context in prompt
  const enrichedInput = {
    ...input,
    previousAnalysis: context,
  };
  
  const result = await this.execute(enrichedInput);
  
  // Update context
  await this.memoryService.updateContext(sessionId, result);
  
  return result;
}
```

## Deployment Considerations

1. **Resource Limits**: Set appropriate timeouts and memory limits
2. **Rate Limiting**: Implement rate limiting for expensive operations
3. **Monitoring**: Add CloudWatch metrics and alarms
4. **Cost Optimization**: Use appropriate model sizes and caching
5. **Security**: Validate all inputs and sanitize outputs

## Next Steps

- Review existing agents for more examples
- Test your agent thoroughly
- Add documentation
- Consider creating a specialized tool wrapper
- Integrate with existing workflows