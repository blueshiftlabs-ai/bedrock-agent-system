import { Module } from '@nestjs/common';
import { IntegrationModule } from '../integrations/integration.module';
import { CodeAnalyzerAgent } from './code-analyzer/code-analyzer.agent';
import { DatabaseAnalyzerAgent } from './db-analyzer/db-analyzer.agent';
import { KnowledgeBuilderAgent } from './knowledge-builder/knowledge-builder.agent';
import { DocumentationGeneratorAgent } from './documentation-generator/documentation-generator.agent';

@Module({
  imports: [IntegrationModule],
  providers: [
    CodeAnalyzerAgent,
    DatabaseAnalyzerAgent,
    KnowledgeBuilderAgent,
    DocumentationGeneratorAgent,
  ],
  exports: [
    CodeAnalyzerAgent,
    DatabaseAnalyzerAgent,
    KnowledgeBuilderAgent,
    DocumentationGeneratorAgent,
  ],
})
export class AgentModule {}
