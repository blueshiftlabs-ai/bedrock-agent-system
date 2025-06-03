import { Injectable, Logger } from '@nestjs/common';
import { MCPTool, MCPToolRegistry } from '../registry/tool.registry';
import { AwsService } from '@aws/aws.service';

@Injectable()
export class KnowledgeGraphTool {
  private readonly logger = new Logger(KnowledgeGraphTool.name);

  constructor(private readonly awsService: AwsService) {}

  async register(registry: MCPToolRegistry): Promise<void> {
    const tool: MCPTool = {
      name: 'update-knowledge-graph',
      description: 'Updates the knowledge graph with new entities and relationships',
      category: 'knowledge',
      parameters: {
        type: 'object',
        required: ['entities', 'relationships'],
        properties: {
          entities: {
            type: 'array',
            description: 'Array of entities to add or update',
            required: true,
          },
          relationships: {
            type: 'array',
            description: 'Array of relationships to add or update',
            required: true,
          },
          source: {
            type: 'string',
            description: 'Source of the information (e.g., code_analysis, manual_input)',
            default: 'mcp_tool',
          },
        },
      },
      execute: this.execute.bind(this),
      timeout: 60000,
      retryable: true,
      cacheable: false, // Knowledge graph updates shouldn't be cached
    };

    registry.registerTool(tool);
  }

  private async execute(params: any): Promise<any> {
    const { entities = [], relationships = [], source = 'mcp_tool' } = params;
    
    this.logger.log(`Updating knowledge graph with ${entities.length} entities and ${relationships.length} relationships`);

    try {
      const result = {
        entitiesAdded: 0,
        entitiesUpdated: 0,
        relationshipsAdded: 0,
        relationshipsUpdated: 0,
        errors: [],
      };

      // Process entities
      for (const entity of entities) {
        try {
          const processed = await this.processEntity(entity, source);
          if (processed.isNew) {
            result.entitiesAdded++;
          } else {
            result.entitiesUpdated++;
          }
        } catch (error) {
          const errorMsg = `Failed to process entity ${entity.id}: ${error.message}`;
          this.logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      // Process relationships
      for (const relationship of relationships) {
        try {
          const processed = await this.processRelationship(relationship, source);
          if (processed.isNew) {
            result.relationshipsAdded++;
          } else {
            result.relationshipsUpdated++;
          }
        } catch (error) {
          const errorMsg = `Failed to process relationship ${relationship.id}: ${error.message}`;
          this.logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      // Store knowledge graph snapshot
      const snapshot = {
        timestamp: new Date().toISOString(),
        source,
        entities,
        relationships,
        result,
      };
      
      const snapshotKey = `knowledge-graph/snapshots/${Date.now()}-${source}.json`;
      await this.awsService.storeInS3(snapshotKey, JSON.stringify(snapshot, null, 2));

      this.logger.log(`Knowledge graph update completed: ${result.entitiesAdded + result.entitiesUpdated} entities, ${result.relationshipsAdded + result.relationshipsUpdated} relationships`);

      return {
        ...result,
        snapshotStoredAt: `s3://${snapshotKey}`,
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error updating knowledge graph:', error);
      throw new Error(`Knowledge graph update failed: ${error.message}`);
    }
  }

  private async processEntity(entity: any, source: string): Promise<{ isNew: boolean }> {
    // In a real implementation, this would interact with Neptune or another graph database
    // For now, this is a mock implementation that stores entities in S3

    const normalizedEntity = {
      id: entity.id || this.generateEntityId(entity),
      type: entity.type || 'unknown',
      properties: entity.properties || {},
      source,
      createdAt: entity.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Check if entity already exists
    const entityKey = `knowledge-graph/entities/${normalizedEntity.id}.json`;
    let existingEntity;
    
    try {
      const existingData = await this.awsService.getFromS3(entityKey);
      existingEntity = JSON.parse(existingData);
    } catch (error) {
      // Entity doesn't exist
      existingEntity = null;
    }

    // Store entity
    await this.awsService.storeInS3(entityKey, JSON.stringify(normalizedEntity, null, 2));
    
    this.logger.debug(`${existingEntity ? 'Updated' : 'Created'} entity: ${normalizedEntity.id}`);
    
    return { isNew: !existingEntity };
  }

  private async processRelationship(relationship: any, source: string): Promise<{ isNew: boolean }> {
    const normalizedRelationship = {
      id: relationship.id || this.generateRelationshipId(relationship),
      fromEntityId: relationship.fromEntityId,
      toEntityId: relationship.toEntityId,
      relationshipType: relationship.relationshipType || 'related_to',
      properties: relationship.properties || {},
      source,
      createdAt: relationship.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Validate that both entities exist
    const fromEntityKey = `knowledge-graph/entities/${normalizedRelationship.fromEntityId}.json`;
    const toEntityKey = `knowledge-graph/entities/${normalizedRelationship.toEntityId}.json`;
    
    try {
      await this.awsService.getFromS3(fromEntityKey);
      await this.awsService.getFromS3(toEntityKey);
    } catch (error) {
      throw new Error(`Referenced entity does not exist: ${error.message}`);
    }

    // Check if relationship already exists
    const relationshipKey = `knowledge-graph/relationships/${normalizedRelationship.id}.json`;
    let existingRelationship;
    
    try {
      const existingData = await this.awsService.getFromS3(relationshipKey);
      existingRelationship = JSON.parse(existingData);
    } catch (error) {
      // Relationship doesn't exist
      existingRelationship = null;
    }

    // Store relationship
    await this.awsService.storeInS3(relationshipKey, JSON.stringify(normalizedRelationship, null, 2));
    
    this.logger.debug(`${existingRelationship ? 'Updated' : 'Created'} relationship: ${normalizedRelationship.id}`);
    
    return { isNew: !existingRelationship };
  }

  private generateEntityId(entity: any): string {
    return `${entity.type || 'entity'}_${entity.name || entity.title || 'unknown'}_${Date.now()}`;
  }

  private generateRelationshipId(relationship: any): string {
    return `${relationship.fromEntityId}_${relationship.relationshipType || 'related_to'}_${relationship.toEntityId}`;
  }
}
