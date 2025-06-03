# Developer Guide

## Table of Contents
- [Overview](#overview)
- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Architecture Deep Dive](#architecture-deep-dive)
- [Creating Custom Agents](#creating-custom-agents)
- [Developing Tools](#developing-tools)
- [Workflow Development](#workflow-development)
- [Memory System Development](#memory-system-development)
- [MCP Integration](#mcp-integration)
- [Testing Strategies](#testing-strategies)
- [Code Style and Standards](#code-style-and-standards)
- [Performance Optimization](#performance-optimization)
- [Debugging Techniques](#debugging-techniques)
- [Contributing Guidelines](#contributing-guidelines)

## Overview

This guide provides comprehensive information for developers working on the Bedrock Agent System. It covers architecture patterns, development practices, and extension mechanisms for building AI-powered workflows and tools.

### Key Development Principles

1. **Modularity**: Components are loosely coupled and highly cohesive
2. **Extensibility**: Easy to add new agents, tools, and workflows
3. **Observability**: Comprehensive logging, metrics, and monitoring
4. **Type Safety**: Full TypeScript implementation with strict typing
5. **Test Coverage**: Unit, integration, and end-to-end testing
6. **Performance**: Efficient resource usage and scalable design

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm 8+
- Docker 20+
- AWS CLI 2+
- Git
- VS Code (recommended) with extensions:
  - TypeScript
  - ESLint
  - Prettier
  - Jest
  - AWS Toolkit

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/bedrock-agent-system.git
cd bedrock-agent-system

# Install dependencies
pnpm install

# Setup development environment
pnpm --filter @apps/mcp-hybrid-server run setup-local-dev

# Start LocalStack for AWS services
docker-compose -f docker-compose.localstack.yml up -d

# Start the application in development mode
pnpm app:dev
```

### Project Structure

```
apps/mcp-hybrid-server/
├── src/
│   ├── agents/                 # AI agent implementations
│   │   ├── base/              # Base agent classes
│   │   ├── code-analyzer/     # Code analysis agent
│   │   ├── db-analyzer/       # Database analysis agent
│   │   ├── documentation-generator/
│   │   └── knowledge-builder/
│   ├── tools/                 # MCP tool implementations
│   │   ├── implementations/   # Tool logic
│   │   ├── registry/         # Tool registration system
│   │   ├── tool.module.ts
│   │   └── tool.service.ts
│   ├── workflows/            # LangGraph workflows
│   │   ├── graphs/          # Workflow definitions
│   │   ├── nodes/           # Workflow node implementations
│   │   ├── states/          # Workflow state definitions
│   │   └── services/        # Workflow services
│   ├── memory/              # Memory management system
│   ├── integrations/        # External service integrations
│   │   ├── bedrock/        # AWS Bedrock integration
│   │   ├── langchain/      # LangChain integration
│   │   └── mcp-client/     # MCP client implementation
│   ├── aws/                # AWS service modules
│   ├── config/             # Configuration management
│   ├── common/             # Shared utilities
│   └── types/              # TypeScript type definitions
├── test/                   # Test files
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # End-to-end tests
├── docs/                  # Documentation
└── scripts/               # Development scripts
```

## Development Environment

### Environment Configuration

Create a `.env.development` file:

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=debug

# AWS Configuration (LocalStack)
AWS_REGION=us-east-1
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# Database Configuration
DYNAMODB_METADATA_TABLE=MCPMetadata-dev
DYNAMODB_WORKFLOW_STATE_TABLE=MCPWorkflowState-dev

# S3 Configuration
AWS_S3_BUCKET=mcp-hybrid-server-data-dev

# MCP Configuration
MCP_SERVER_ENABLED=true
MCP_CLIENT_ENABLED=true
MCP_ENABLE_LOGGING=true
MCP_LOG_LEVEL=debug
```

### Development Scripts

```bash
# Start development server with hot reload
pnpm dev

# Run tests
pnpm test                # Unit tests
pnpm test:watch         # Watch mode
pnpm test:e2e           # End-to-end tests
pnpm test:coverage      # Coverage report

# Code quality
pnpm lint               # ESLint
pnpm lint:fix           # Fix linting issues
pnpm format             # Prettier formatting
pnpm type-check         # TypeScript checking

# Build
pnpm build              # Production build
pnpm build:dev          # Development build

# Docker
pnpm docker:build       # Build Docker image
pnpm docker:run         # Run Docker container
```

### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "jest.autoRun": "watch",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.turbo": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.turbo": true
  }
}
```

## Architecture Deep Dive

### Dependency Injection Pattern

The system uses NestJS's dependency injection extensively:

```typescript
// Example service with dependencies
@Injectable()
export class WorkflowService {
  constructor(
    private readonly agentService: AgentService,
    private readonly toolRegistry: MCPToolRegistry,
    private readonly stateService: WorkflowStateService,
    private readonly logger: Logger,
  ) {}

  async executeWorkflow(config: WorkflowConfig): Promise<WorkflowResult> {
    // Implementation
  }
}
```

### Event-Driven Architecture

Use EventEmitter2 for decoupled communication:

```typescript
// Emitting events
@Injectable()
export class ToolService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async executeTool(toolName: string, params: any): Promise<any> {
    this.eventEmitter.emit('tool.execution.started', { toolName, params });
    
    try {
      const result = await this.performExecution(toolName, params);
      this.eventEmitter.emit('tool.execution.completed', { toolName, result });
      return result;
    } catch (error) {
      this.eventEmitter.emit('tool.execution.failed', { toolName, error });
      throw error;
    }
  }
}

// Listening to events
@Injectable()
export class MetricsService {
  @OnEvent('tool.execution.*')
  handleToolEvent(payload: any) {
    // Update metrics
  }
}
```

### Configuration Management

Use the configuration pattern:

```typescript
// Define configuration interface
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  retryAttempts: number;
}

// Register configuration
@Module({
  imports: [
    ConfigModule.forFeature(databaseConfig),
  ],
})
export class DatabaseModule {}

// Use configuration in services
@Injectable()
export class DatabaseService {
  constructor(
    @Inject(databaseConfig.KEY)
    private config: ConfigType<typeof databaseConfig>,
  ) {}
}
```

## Creating Custom Agents

### Base Agent Implementation

All agents extend the `BaseAgent` class:

```typescript
// src/agents/base/base.agent.ts
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
```

### Custom Agent Example

```typescript
// src/agents/custom-analyzer/custom-analyzer.agent.ts
@Injectable()
export class CustomAnalyzerAgent extends BaseAgent {
  constructor(
    @Inject('BEDROCK_CLIENT') client: BedrockMcpClient,
    private readonly memoryService: MemoryService,
  ) {
    super(client, 'CustomAnalyzer');
  }

  protected async processRequest(prompt: string, options?: any): Promise<any> {
    // Build the prompt with system instructions
    const fullPrompt = this.buildPrompt(prompt, options?.context);
    
    // Retrieve relevant memory if available
    let relevantMemory = [];
    if (options?.useMemory) {
      relevantMemory = await this.memoryService.search({
        query: prompt,
        limit: 5,
        threshold: 0.7,
      });
    }

    // Add memory context to prompt
    if (relevantMemory.length > 0) {
      const memoryContext = relevantMemory
        .map(mem => mem.content)
        .join('\n\n');
      fullPrompt += `\n\nRelevant Memory:\n${memoryContext}`;
    }

    // Call Bedrock with the enhanced prompt
    const response = await this.client.invokeModel({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      body: {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature || 0.2,
        messages: [
          {
            role: 'user',
            content: fullPrompt,
          },
        ],
      },
    });

    // Process and return the response
    const result = this.parseResponse(response);
    
    // Store the interaction in memory if requested
    if (options?.storeInMemory) {
      await this.memoryService.store({
        content: `User: ${prompt}\n\nAnalysis: ${result.summary}`,
        contentType: 'interaction',
        metadata: {
          agentType: this.name,
          timestamp: new Date().toISOString(),
          category: 'analysis',
        },
      });
    }

    return result;
  }

  protected getSystemPrompt(): string {
    return `
You are a specialized custom analyzer agent. Your role is to:

1. Analyze the provided input using your specialized knowledge
2. Provide detailed insights and recommendations
3. Identify patterns and potential issues
4. Suggest optimization opportunities

Always provide structured, actionable output that includes:
- Summary of findings
- Detailed analysis
- Recommendations
- Risk assessment (if applicable)

Format your response as JSON with the following structure:
{
  "summary": "Brief overview of findings",
  "analysis": {
    "findings": ["list", "of", "key", "findings"],
    "patterns": ["identified", "patterns"],
    "issues": ["potential", "issues"]
  },
  "recommendations": ["actionable", "recommendations"],
  "confidence": 0.95,
  "metadata": {
    "analysisType": "custom",
    "timestamp": "ISO timestamp"
  }
}
    `.trim();
  }

  private parseResponse(response: any): any {
    try {
      const content = response.body.content[0].text;
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Failed to parse agent response:', error);
      return {
        summary: 'Analysis completed with parsing errors',
        analysis: { findings: [], patterns: [], issues: [] },
        recommendations: [],
        confidence: 0.5,
        error: error.message,
      };
    }
  }
}
```

### Agent Registration

```typescript
// src/agents/custom-analyzer/custom-analyzer.module.ts
@Module({
  providers: [
    CustomAnalyzerAgent,
    {
      provide: 'CUSTOM_ANALYZER_AGENT',
      useClass: CustomAnalyzerAgent,
    },
  ],
  exports: [CustomAnalyzerAgent],
})
export class CustomAnalyzerModule {}

// Add to main agent module
@Module({
  imports: [
    // ... other modules
    CustomAnalyzerModule,
  ],
  exports: [
    // ... other exports
    CustomAnalyzerModule,
  ],
})
export class AgentModule {}
```

## Developing Tools

### Tool Interface

All tools implement the `MCPTool` interface:

```typescript
export interface MCPTool {
  name: string;
  description: string;
  category: string;
  parameters: MCPToolParameterSchema;
  execute: (params: any, context?: any) => Promise<any>;
  timeout?: number;
  retryable?: boolean;
  cacheable?: boolean;
}
```

### Custom Tool Implementation

```typescript
// src/tools/implementations/custom-analysis.tool.ts
@Injectable()
export class CustomAnalysisTool {
  private readonly logger = new Logger(CustomAnalysisTool.name);

  constructor(
    private readonly customAgent: CustomAnalyzerAgent,
    private readonly toolRegistry: MCPToolRegistry,
  ) {
    this.registerTool();
  }

  private registerTool(): void {
    const tool: MCPTool = {
      name: 'custom_analysis',
      description: 'Perform custom analysis on provided input',
      category: 'analysis',
      parameters: {
        type: 'object',
        required: ['input', 'analysisType'],
        properties: {
          input: {
            type: 'string',
            description: 'The input data to analyze',
          },
          analysisType: {
            type: 'string',
            description: 'Type of analysis to perform',
            enum: ['basic', 'detailed', 'comprehensive'],
            default: 'basic',
          },
          options: {
            type: 'object',
            description: 'Additional analysis options',
            required: false,
            properties: {
              useMemory: {
                type: 'boolean',
                description: 'Whether to use memory for context',
                default: false,
              },
              storeResult: {
                type: 'boolean',
                description: 'Whether to store the result in memory',
                default: true,
              },
              temperature: {
                type: 'number',
                description: 'AI temperature setting',
                default: 0.2,
              },
            },
          },
        },
      },
      execute: this.execute.bind(this),
      timeout: 300000, // 5 minutes
      retryable: true,
      cacheable: true,
    };

    this.toolRegistry.registerTool(tool);
    this.logger.log('Custom analysis tool registered');
  }

  async execute(params: any, context?: any): Promise<any> {
    const { input, analysisType, options = {} } = params;

    this.logger.log(`Executing custom analysis: ${analysisType}`);

    try {
      // Validate input
      this.validateInput(input, analysisType);

      // Prepare analysis prompt based on type
      const prompt = this.buildAnalysisPrompt(input, analysisType);

      // Execute analysis using the custom agent
      const result = await this.customAgent.execute(prompt, {
        ...options,
        context: {
          ...context,
          analysisType,
          inputLength: input.length,
        },
      });

      // Enhance result with metadata
      const enhancedResult = {
        ...result,
        metadata: {
          ...result.metadata,
          toolName: 'custom_analysis',
          analysisType,
          inputSize: input.length,
          executionTime: Date.now(),
        },
      };

      this.logger.log('Custom analysis completed successfully');
      return enhancedResult;

    } catch (error) {
      this.logger.error(`Custom analysis failed: ${error.message}`);
      throw new Error(`Custom analysis failed: ${error.message}`);
    }
  }

  private validateInput(input: string, analysisType: string): void {
    if (!input || input.trim().length === 0) {
      throw new Error('Input cannot be empty');
    }

    if (input.length > 100000) {
      throw new Error('Input too large (max 100KB)');
    }

    const validTypes = ['basic', 'detailed', 'comprehensive'];
    if (!validTypes.includes(analysisType)) {
      throw new Error(`Invalid analysis type: ${analysisType}`);
    }
  }

  private buildAnalysisPrompt(input: string, analysisType: string): string {
    const basePrompt = `Please perform a ${analysisType} analysis of the following input:

${input}

Analysis Type: ${analysisType}`;

    switch (analysisType) {
      case 'basic':
        return `${basePrompt}

Focus on:
- High-level overview
- Key characteristics
- Basic patterns`;

      case 'detailed':
        return `${basePrompt}

Focus on:
- Comprehensive examination
- Detailed patterns and structures
- Relationships and dependencies
- Potential improvements`;

      case 'comprehensive':
        return `${basePrompt}

Focus on:
- Complete end-to-end analysis
- Deep pattern recognition
- Risk assessment
- Optimization opportunities
- Future recommendations`;

      default:
        return basePrompt;
    }
  }
}
```

### Tool Module Registration

```typescript
// src/tools/implementations/implementations.module.ts
@Module({
  providers: [
    // ... existing tools
    CustomAnalysisTool,
  ],
  exports: [
    // ... existing tools
    CustomAnalysisTool,
  ],
})
export class ToolImplementationsModule {}
```

## Workflow Development

### Workflow State Definition

```typescript
// src/workflows/states/custom-workflow-state.ts
export interface CustomWorkflowState extends BaseWorkflowState {
  workflowId: string;
  stage: 'start' | 'preprocessing' | 'analysis' | 'postprocessing' | 'completed' | 'error';
  inputData: any;
  preprocessingResult?: any;
  analysisResult?: any;
  postprocessingResult?: any;
  finalResult?: any;
  error?: string;
  options: {
    enableCaching: boolean;
    analysisDepth: 'basic' | 'detailed' | 'comprehensive';
    outputFormat: 'json' | 'markdown' | 'html';
  };
}
```

### Workflow Nodes

```typescript
// src/workflows/nodes/custom-workflow-nodes.ts
@Injectable()
export class CustomWorkflowNodes {
  private readonly logger = new Logger(CustomWorkflowNodes.name);

  constructor(
    private readonly customTool: CustomAnalysisTool,
    private readonly memoryService: MemoryService,
  ) {}

  async preprocessData(state: CustomWorkflowState): Promise<CustomWorkflowState> {
    this.logger.log(`Preprocessing data for workflow: ${state.workflowId}`);

    try {
      // Perform data preprocessing
      const preprocessedData = await this.performPreprocessing(state.inputData);

      return {
        ...state,
        stage: 'analysis',
        preprocessingResult: preprocessedData,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Preprocessing failed: ${error.message}`);
      return {
        ...state,
        stage: 'error',
        error: `Preprocessing failed: ${error.message}`,
        lastUpdated: Date.now(),
      };
    }
  }

  async performAnalysis(state: CustomWorkflowState): Promise<CustomWorkflowState> {
    this.logger.log(`Performing analysis for workflow: ${state.workflowId}`);

    try {
      const inputData = state.preprocessingResult || state.inputData;
      
      // Execute custom analysis tool
      const analysisResult = await this.customTool.execute({
        input: JSON.stringify(inputData),
        analysisType: state.options.analysisDepth,
        options: {
          useMemory: true,
          storeResult: true,
        },
      });

      return {
        ...state,
        stage: 'postprocessing',
        analysisResult,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Analysis failed: ${error.message}`);
      return {
        ...state,
        stage: 'error',
        error: `Analysis failed: ${error.message}`,
        lastUpdated: Date.now(),
      };
    }
  }

  async postprocessResults(state: CustomWorkflowState): Promise<CustomWorkflowState> {
    this.logger.log(`Postprocessing results for workflow: ${state.workflowId}`);

    try {
      // Format results based on output format
      const formattedResult = await this.formatResults(
        state.analysisResult,
        state.options.outputFormat,
      );

      return {
        ...state,
        stage: 'completed',
        postprocessingResult: formattedResult,
        finalResult: formattedResult,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Postprocessing failed: ${error.message}`);
      return {
        ...state,
        stage: 'error',
        error: `Postprocessing failed: ${error.message}`,
        lastUpdated: Date.now(),
      };
    }
  }

  private async performPreprocessing(inputData: any): Promise<any> {
    // Implement preprocessing logic
    return {
      ...inputData,
      preprocessed: true,
      timestamp: new Date().toISOString(),
    };
  }

  private async formatResults(result: any, format: string): Promise<any> {
    switch (format) {
      case 'json':
        return result;
      
      case 'markdown':
        return this.convertToMarkdown(result);
      
      case 'html':
        return this.convertToHtml(result);
      
      default:
        return result;
    }
  }

  private convertToMarkdown(result: any): string {
    // Implement markdown conversion
    return `# Analysis Result\n\n${JSON.stringify(result, null, 2)}`;
  }

  private convertToHtml(result: any): string {
    // Implement HTML conversion
    return `<div class="analysis-result">${JSON.stringify(result, null, 2)}</div>`;
  }
}
```

### Workflow Graph Definition

```typescript
// src/workflows/graphs/custom-workflow.ts
@Injectable()
export class CustomWorkflow {
  private readonly logger = new Logger(CustomWorkflow.name);
  private workflow: any;

  constructor(
    private readonly nodes: CustomWorkflowNodes,
    private readonly stateService: WorkflowStateService,
  ) {
    this.initializeWorkflow();
  }

  private initializeWorkflow() {
    // Define router function
    const router = (state: CustomWorkflowState): string => {
      if (state.error) {
        return END;
      }
      
      switch (state.stage) {
        case 'start':
          return 'preprocess_data';
        case 'preprocessing':
          return 'perform_analysis';
        case 'analysis':
          return 'postprocess_results';
        case 'postprocessing':
          return END;
        case 'completed':
          return END;
        default:
          return END;
      }
    };

    // Create workflow graph
    this.workflow = new StateGraph<CustomWorkflowState>({
      channels: {
        workflowId: { default: () => '' },
        stage: { default: () => 'start' },
        inputData: { default: () => null },
        preprocessingResult: { default: () => null },
        analysisResult: { default: () => null },
        postprocessingResult: { default: () => null },
        finalResult: { default: () => null },
        error: { default: () => null },
        options: { default: () => ({
          enableCaching: true,
          analysisDepth: 'basic',
          outputFormat: 'json',
        })},
        startTime: { default: () => Date.now() },
        lastUpdated: { default: () => Date.now() },
      }
    });

    // Add nodes
    this.workflow.addNode('preprocess_data', this.nodes.preprocessData.bind(this.nodes));
    this.workflow.addNode('perform_analysis', this.nodes.performAnalysis.bind(this.nodes));
    this.workflow.addNode('postprocess_results', this.nodes.postprocessResults.bind(this.nodes));

    // Set entry point
    this.workflow.setEntryPoint('preprocess_data');

    // Add conditional edges
    this.workflow.addConditionalEdges('preprocess_data', router);
    this.workflow.addConditionalEdges('perform_analysis', router);
    this.workflow.addConditionalEdges('postprocess_results', router);

    // Compile workflow
    this.workflow = this.workflow.compile();
  }

  async execute(
    inputData: any,
    options?: Partial<CustomWorkflowState['options']>,
    workflowId?: string,
  ): Promise<CustomWorkflowState> {
    const id = workflowId || `custom_workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const initialState: CustomWorkflowState = {
      workflowId: id,
      stage: 'start',
      inputData,
      options: {
        enableCaching: true,
        analysisDepth: 'basic',
        outputFormat: 'json',
        ...options,
      },
      startTime: Date.now(),
      lastUpdated: Date.now(),
    };

    try {
      this.logger.log(`Starting custom workflow: ${id}`);
      await this.stateService.saveWorkflowState(id, initialState);
      
      const result = await this.workflow.invoke(initialState);
      
      await this.stateService.saveWorkflowState(id, {
        ...result,
        stage: 'completed',
        lastUpdated: Date.now(),
      });
      
      this.logger.log(`Custom workflow completed: ${id}`);
      return result;
    } catch (error) {
      this.logger.error(`Custom workflow failed: ${error.message}`);
      
      const errorState = {
        ...initialState,
        stage: 'error' as const,
        error: error.message,
        lastUpdated: Date.now(),
      };
      
      await this.stateService.saveWorkflowState(id, errorState);
      throw error;
    }
  }
}
```

## Memory System Development

### Custom Memory Provider

```typescript
// src/memory/providers/custom-memory.provider.ts
@Injectable()
export class CustomMemoryProvider {
  private readonly logger = new Logger(CustomMemoryProvider.name);

  constructor(
    private readonly opensearchService: OpenSearchService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async store(memoryItem: MemoryItem): Promise<string> {
    try {
      // Generate embedding if not provided
      if (!memoryItem.embedding) {
        memoryItem.embedding = await this.embeddingService.generateEmbedding(
          memoryItem.content,
        );
      }

      // Add custom metadata
      const enhancedItem = {
        ...memoryItem,
        metadata: {
          ...memoryItem.metadata,
          provider: 'custom',
          storedAt: new Date().toISOString(),
          version: '1.0',
        },
      };

      // Store in OpenSearch
      const memoryId = await this.opensearchService.index({
        index: 'custom-memory',
        body: enhancedItem,
      });

      this.logger.log(`Memory item stored: ${memoryId}`);
      return memoryId;
    } catch (error) {
      this.logger.error(`Failed to store memory item: ${error.message}`);
      throw error;
    }
  }

  async search(query: MemorySearchQuery): Promise<MemorySearchResult[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(
        query.query,
      );

      // Build OpenSearch query
      const searchQuery = {
        index: 'custom-memory',
        body: {
          query: {
            bool: {
              must: [
                {
                  knn: {
                    embedding: {
                      vector: queryEmbedding,
                      k: query.limit || 10,
                    },
                  },
                },
              ],
              filter: this.buildFilters(query.filters),
            },
          },
          min_score: query.threshold || 0.6,
          size: query.limit || 10,
        },
      };

      // Execute search
      const response = await this.opensearchService.search(searchQuery);

      // Process and rank results
      const results = response.body.hits.hits.map(hit => ({
        memoryId: hit._id,
        content: hit._source.content,
        metadata: hit._source.metadata,
        relevanceScore: hit._score,
        createdAt: hit._source.createdAt,
      }));

      // Apply custom ranking if needed
      const rankedResults = this.applyCustomRanking(results, query);

      this.logger.log(`Memory search completed: ${results.length} results`);
      return rankedResults;
    } catch (error) {
      this.logger.error(`Memory search failed: ${error.message}`);
      throw error;
    }
  }

  private buildFilters(filters?: Record<string, any>): any[] {
    if (!filters) return [];

    return Object.entries(filters).map(([key, value]) => ({
      term: { [`metadata.${key}`]: value },
    }));
  }

  private applyCustomRanking(
    results: MemorySearchResult[],
    query: MemorySearchQuery,
  ): MemorySearchResult[] {
    // Implement custom ranking logic
    return results.sort((a, b) => {
      // Boost recent items
      const recencyWeight = 0.1;
      const aRecency = Date.now() - new Date(a.createdAt).getTime();
      const bRecency = Date.now() - new Date(b.createdAt).getTime();
      
      const aScore = a.relevanceScore - (aRecency * recencyWeight);
      const bScore = b.relevanceScore - (bRecency * recencyWeight);
      
      return bScore - aScore;
    });
  }
}
```

## MCP Integration

### Custom MCP Server

```typescript
// src/integrations/mcp-server/custom-mcp-server.ts
@Injectable()
export class CustomMCPServer {
  private readonly logger = new Logger(CustomMCPServer.name);

  constructor(
    private readonly toolRegistry: MCPToolRegistry,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      this.logger.debug(`Handling MCP request: ${request.method}`);

      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);
        
        case 'tools/list':
          return this.handleToolsList(request);
        
        case 'tools/call':
          return this.handleToolCall(request);
        
        default:
          throw new Error(`Unsupported method: ${request.method}`);
      }
    } catch (error) {
      this.logger.error(`MCP request failed: ${error.message}`);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error.message,
        },
      };
    }
  }

  private async handleInitialize(request: MCPRequest): Promise<MCPResponse> {
    const { protocolVersion, capabilities, clientInfo } = request.params;

    this.logger.log(`MCP client connected: ${clientInfo.name} v${clientInfo.version}`);

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
        serverInfo: {
          name: 'custom-mcp-server',
          version: '1.0.0',
        },
      },
    };
  }

  private async handleToolsList(request: MCPRequest): Promise<MCPResponse> {
    const tools = this.toolRegistry.formatToolsForMCP();

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.parameters,
        })),
      },
    };
  }

  private async handleToolCall(request: MCPRequest): Promise<MCPResponse> {
    const { name, arguments: args } = request.params;

    try {
      const result = await this.toolRegistry.executeTool(name, args);

      // Emit event for monitoring
      this.eventEmitter.emit('mcp.tool.executed', {
        toolName: name,
        success: true,
        clientInfo: request.clientInfo,
      });

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: false,
        },
      };
    } catch (error) {
      this.eventEmitter.emit('mcp.tool.failed', {
        toolName: name,
        error: error.message,
        clientInfo: request.clientInfo,
      });

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: `Tool execution failed: ${error.message}`,
            },
          ],
          isError: true,
        },
      };
    }
  }
}
```

## Testing Strategies

### Unit Testing

```typescript
// test/unit/agents/custom-analyzer.agent.spec.ts
describe('CustomAnalyzerAgent', () => {
  let agent: CustomAnalyzerAgent;
  let mockBedrockClient: jest.Mocked<BedrockMcpClient>;
  let mockMemoryService: jest.Mocked<MemoryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomAnalyzerAgent,
        {
          provide: 'BEDROCK_CLIENT',
          useValue: {
            invokeModel: jest.fn(),
          },
        },
        {
          provide: MemoryService,
          useValue: {
            search: jest.fn(),
            store: jest.fn(),
          },
        },
      ],
    }).compile();

    agent = module.get<CustomAnalyzerAgent>(CustomAnalyzerAgent);
    mockBedrockClient = module.get('BEDROCK_CLIENT');
    mockMemoryService = module.get(MemoryService);
  });

  describe('execute', () => {
    it('should execute analysis successfully', async () => {
      // Arrange
      const prompt = 'Analyze this code';
      const mockResponse = {
        body: {
          content: [
            {
              text: JSON.stringify({
                summary: 'Code analysis complete',
                analysis: { findings: ['No issues found'] },
                recommendations: ['Keep up the good work'],
                confidence: 0.95,
              }),
            },
          ],
        },
      };

      mockBedrockClient.invokeModel.mockResolvedValue(mockResponse);
      mockMemoryService.search.mockResolvedValue([]);

      // Act
      const result = await agent.execute(prompt);

      // Assert
      expect(result.summary).toBe('Code analysis complete');
      expect(result.confidence).toBe(0.95);
      expect(mockBedrockClient.invokeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        }),
      );
    });

    it('should handle memory integration', async () => {
      // Arrange
      const prompt = 'Analyze with memory';
      const options = { useMemory: true };
      const mockMemory = [
        { content: 'Previous analysis results', relevanceScore: 0.8 },
      ];

      mockMemoryService.search.mockResolvedValue(mockMemory);
      mockBedrockClient.invokeModel.mockResolvedValue({
        body: { content: [{ text: '{"summary": "Analysis complete"}' }] },
      });

      // Act
      await agent.execute(prompt, options);

      // Assert
      expect(mockMemoryService.search).toHaveBeenCalledWith({
        query: prompt,
        limit: 5,
        threshold: 0.7,
      });
    });
  });
});
```

### Integration Testing

```typescript
// test/integration/workflows/custom-workflow.spec.ts
describe('CustomWorkflow Integration', () => {
  let app: INestApplication;
  let workflowService: WorkflowService;
  let dynamodbService: DynamodbService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    workflowService = module.get<WorkflowService>(WorkflowService);
    dynamodbService = module.get<DynamodbService>(DynamodbService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should execute custom workflow end-to-end', async () => {
    // Arrange
    const inputData = { type: 'test', content: 'Sample data' };
    const options = {
      analysisDepth: 'detailed' as const,
      outputFormat: 'json' as const,
    };

    // Act
    const result = await workflowService.executeCustomWorkflow(
      inputData,
      options,
    );

    // Assert
    expect(result.stage).toBe('completed');
    expect(result.finalResult).toBeDefined();
    expect(result.error).toBeUndefined();

    // Verify workflow state was persisted
    const savedState = await dynamodbService.getWorkflowState(result.workflowId);
    expect(savedState).toBeDefined();
    expect(savedState.stage).toBe('completed');
  });
});
```

### End-to-End Testing

```typescript
// test/e2e/api.e2e-spec.ts
describe('API E2E Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/workflows (POST)', () => {
    it('should create and execute workflow', async () => {
      const workflowData = {
        type: 'custom_analysis',
        parameters: {
          input: 'Test data',
          analysisType: 'basic',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .send(workflowData)
        .expect(201);

      expect(response.body.data.workflowId).toBeDefined();
      expect(response.body.data.status).toBe('running');

      // Wait for completion and check status
      const workflowId = response.body.data.workflowId;
      let completed = false;
      let attempts = 0;

      while (!completed && attempts < 30) {
        const statusResponse = await request(app.getHttpServer())
          .get(`/api/v1/workflows/${workflowId}`)
          .expect(200);

        if (statusResponse.body.data.status === 'completed') {
          completed = true;
          expect(statusResponse.body.data.result).toBeDefined();
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      expect(completed).toBe(true);
    });
  });
});
```

## Code Style and Standards

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2020",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"],
      "@agents/*": ["src/agents/*"],
      "@tools/*": ["src/tools/*"],
      "@workflows/*": ["src/workflows/*"],
      "@integrations/*": ["src/integrations/*"]
    },
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### ESLint Configuration

```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.ts'],
    extends: [
      '@typescript-eslint/recommended',
      '@typescript-eslint/recommended-requiring-type-checking',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
      project: 'tsconfig.json',
      tsconfigRootDir: __dirname,
      sourceType: 'module',
    },
    plugins: ['@typescript-eslint/eslint-plugin'],
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/prefer-const': 'error',
      'prefer-const': 'off',
    },
  },
];
```

### Naming Conventions

- **Classes**: PascalCase (`CustomAnalyzerAgent`)
- **Interfaces**: PascalCase with 'I' prefix optional (`WorkflowState`)
- **Variables/Functions**: camelCase (`executeWorkflow`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)
- **Files**: kebab-case (`custom-analyzer.agent.ts`)
- **Directories**: kebab-case (`custom-analyzer/`)

### Documentation Standards

Use JSDoc for comprehensive documentation:

```typescript
/**
 * Custom analyzer agent for specialized analysis tasks.
 * 
 * @example
 * ```typescript
 * const agent = new CustomAnalyzerAgent(bedrockClient, memoryService);
 * const result = await agent.execute('Analyze this code', {
 *   useMemory: true,
 *   temperature: 0.2
 * });
 * ```
 */
@Injectable()
export class CustomAnalyzerAgent extends BaseAgent {
  /**
   * Execute analysis with the given prompt and options.
   * 
   * @param prompt - The analysis prompt
   * @param options - Optional execution parameters
   * @param options.useMemory - Whether to use memory for context
   * @param options.storeInMemory - Whether to store results in memory
   * @param options.temperature - AI model temperature setting
   * @returns Promise resolving to analysis results
   * 
   * @throws {Error} When analysis fails or invalid parameters provided
   */
  async execute(
    prompt: string,
    options?: {
      useMemory?: boolean;
      storeInMemory?: boolean;
      temperature?: number;
    }
  ): Promise<AnalysisResult> {
    // Implementation
  }
}
```

## Performance Optimization

### Memory Management

```typescript
// Implement proper cleanup
@Injectable()
export class LargeDataProcessor implements OnModuleDestroy {
  private cache = new Map<string, any>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Every minute
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }

  private cleanupExpiredEntries() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > 300000) { // 5 minutes
        this.cache.delete(key);
      }
    }
  }
}
```

### Async Operations

```typescript
// Use parallel processing where possible
async processMultipleItems(items: any[]): Promise<any[]> {
  // Process in batches to avoid overwhelming the system
  const batchSize = 5;
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => this.processItem(item))
    );
    results.push(...batchResults);
  }

  return results;
}
```

### Caching Strategies

```typescript
// Implement intelligent caching
@Injectable()
export class CacheService {
  private cache = new Map<string, CacheEntry>();

  async getOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttl: number = 300000, // 5 minutes
  ): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.value;
    }

    const value = await computeFn();
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });

    return value;
  }
}
```

## Debugging Techniques

### Logging Strategies

```typescript
// Structured logging with context
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  async executeWorkflow(config: WorkflowConfig): Promise<WorkflowResult> {
    const correlationId = uuidv4();
    
    this.logger.log('Workflow execution started', {
      correlationId,
      workflowType: config.type,
      parameters: config.parameters,
    });

    try {
      const result = await this.performWorkflow(config, correlationId);
      
      this.logger.log('Workflow execution completed', {
        correlationId,
        duration: result.executionTime,
        status: 'success',
      });

      return result;
    } catch (error) {
      this.logger.error('Workflow execution failed', {
        correlationId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}
```

### Development Tools

```typescript
// Debug middleware for development
export function debugMiddleware(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
  }
  next();
}
```

## Contributing Guidelines

### Pull Request Process

1. **Branch Naming**: Use descriptive branch names
   - `feature/custom-analysis-agent`
   - `fix/memory-leak-in-tool-registry`
   - `docs/update-developer-guide`

2. **Commit Messages**: Follow conventional commits
   ```
   feat: add custom analysis agent
   fix: resolve memory leak in tool registry
   docs: update developer guide with new patterns
   ```

3. **Code Review Checklist**:
   - [ ] Code follows style guidelines
   - [ ] Tests are included and passing
   - [ ] Documentation is updated
   - [ ] No breaking changes (or properly documented)
   - [ ] Performance impact assessed

### Development Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-new-feature

# 2. Make changes and test
pnpm test
pnpm lint
pnpm type-check

# 3. Commit changes
git add .
git commit -m "feat: add new feature"

# 4. Push and create PR
git push origin feature/my-new-feature
```

This developer guide provides the foundation for extending and maintaining the Bedrock Agent System. It emphasizes clean architecture, comprehensive testing, and performance optimization while maintaining code quality and consistency.