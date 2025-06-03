import { Module, OnModuleInit } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AwsModule } from '@aws/aws.module';
import { MCPToolRegistry } from './registry/tool.registry';
import { CodeAnalysisTool } from './implementations/code-analysis.tool';
import { DatabaseAnalysisTool } from './implementations/database-analysis.tool';
import { DocumentRetrievalTool } from './implementations/document-retrieval.tool';
import { KnowledgeGraphTool } from './implementations/knowledge-graph.tool';
import { ToolService } from './tool.service';

@Module({
  imports: [EventEmitterModule, AwsModule],
  providers: [
    MCPToolRegistry,
    CodeAnalysisTool,
    DatabaseAnalysisTool,
    DocumentRetrievalTool,
    KnowledgeGraphTool,
    ToolService,
  ],
  exports: [MCPToolRegistry, ToolService],
})
export class ToolModule implements OnModuleInit {
  constructor(
    private readonly toolRegistry: MCPToolRegistry,
    private readonly codeAnalysisTool: CodeAnalysisTool,
    private readonly databaseAnalysisTool: DatabaseAnalysisTool,
    private readonly documentRetrievalTool: DocumentRetrievalTool,
    private readonly knowledgeGraphTool: KnowledgeGraphTool,
  ) {}

  async onModuleInit() {
    // Register all tools
    await this.codeAnalysisTool.register(this.toolRegistry);
    await this.databaseAnalysisTool.register(this.toolRegistry);
    await this.documentRetrievalTool.register(this.toolRegistry);
    await this.knowledgeGraphTool.register(this.toolRegistry);
  }
}
