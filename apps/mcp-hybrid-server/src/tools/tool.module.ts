import { Module, OnModuleInit, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { AwsModule } from '@aws/aws.module';
import { MCPToolRegistry } from './registry/tool.registry';
import { DynamicToolRegistry } from './registry/dynamic-tool.registry';
import { CodeAnalysisTool } from './implementations/code-analysis.tool';
import { DatabaseAnalysisTool } from './implementations/database-analysis.tool';
import { DocumentRetrievalTool } from './implementations/document-retrieval.tool';
import { KnowledgeGraphTool } from './implementations/knowledge-graph.tool';
import { ToolService } from './tool.service';
import { DynamicToolService } from './dynamic-tool.service';
import { ToolController } from './tool.controller';
import { ToolEventsGateway } from './websocket/tool-events.gateway';
import { ToolAuthMiddleware } from './middleware/tool-auth.middleware';
import { ToolAuthGuard } from './guards/tool-auth.guard';
import { ToolPermissionGuard } from './guards/tool-permission.guard';

@Module({
  imports: [EventEmitterModule, ConfigModule, AwsModule],
  controllers: [ToolController],
  providers: [
    MCPToolRegistry,
    DynamicToolRegistry,
    CodeAnalysisTool,
    DatabaseAnalysisTool,
    DocumentRetrievalTool,
    KnowledgeGraphTool,
    ToolService,
    DynamicToolService,
    ToolEventsGateway,
    ToolAuthMiddleware,
    ToolAuthGuard,
    ToolPermissionGuard,
  ],
  exports: [MCPToolRegistry, DynamicToolRegistry, ToolService, DynamicToolService],
})
export class ToolModule implements OnModuleInit, NestModule {
  constructor(
    private readonly toolRegistry: MCPToolRegistry,
    private readonly dynamicToolRegistry: DynamicToolRegistry,
    private readonly codeAnalysisTool: CodeAnalysisTool,
    private readonly databaseAnalysisTool: DatabaseAnalysisTool,
    private readonly documentRetrievalTool: DocumentRetrievalTool,
    private readonly knowledgeGraphTool: KnowledgeGraphTool,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ToolAuthMiddleware)
      .forRoutes('/api/v1/tools');
  }

  async onModuleInit() {
    // Register all tools
    await this.codeAnalysisTool.register(this.toolRegistry);
    await this.databaseAnalysisTool.register(this.toolRegistry);
    await this.documentRetrievalTool.register(this.toolRegistry);
    await this.knowledgeGraphTool.register(this.toolRegistry);
  }
}
