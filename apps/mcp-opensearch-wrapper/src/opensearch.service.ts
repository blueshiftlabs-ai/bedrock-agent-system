import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';

const IndexDocumentSchema = z.object({
  index: z.string().describe('Index name'),
  id: z.string().optional().describe('Document ID'),
  document: z.record(z.any()).describe('Document to index'),
  refresh: z.boolean().optional().default(true).describe('Refresh index immediately'),
});

const SearchDocumentsSchema = z.object({
  index: z.string().describe('Index name'),
  query: z.string().optional().describe('Search query'),
  vector_field: z.string().optional().describe('Vector field name for similarity search'),
  vector: z.array(z.number()).optional().describe('Query vector for similarity search'),
  k: z.number().optional().default(10).describe('Number of results to return'),
  filters: z.record(z.any()).optional().describe('Additional filters'),
});

const CreateIndexSchema = z.object({
  index: z.string().describe('Index name'),
  mappings: z.record(z.any()).optional().describe('Index mappings'),
  settings: z.record(z.any()).optional().describe('Index settings'),
});

const DeleteDocumentSchema = z.object({
  index: z.string().describe('Index name'),
  id: z.string().describe('Document ID to delete'),
  refresh: z.boolean().optional().default(true).describe('Refresh index immediately'),
});

@Injectable()
export class OpenSearchService implements OnModuleInit {
  private readonly logger = new Logger(OpenSearchService.name);
  private client: Client;

  constructor(private readonly mcpService: McpService) {}

  async onModuleInit() {
    const endpoint = process.env.OPENSEARCH_ENDPOINT || 'http://localhost:9200';
    const username = process.env.OPENSEARCH_USERNAME;
    const password = process.env.OPENSEARCH_PASSWORD;
    
    this.client = new Client({
      node: endpoint,
      ...(username && password && {
        auth: {
          username,
          password,
        },
      }),
    });

    try {
      const health = await this.client.cluster.health();
      this.logger.log(`Connected to OpenSearch cluster: ${health.body.cluster_name}`);
    } catch (error) {
      this.logger.error('Failed to connect to OpenSearch', error);
    }

    this.registerTools();
  }

  private registerTools() {
    this.mcpService.registerTool(
      Tool.create<typeof IndexDocumentSchema>({
        name: 'index-document',
        description: 'Index a document in OpenSearch',
        inputSchema: IndexDocumentSchema,
        handler: async (params) => {
          const { index, id, document, refresh } = params;
          
          const body = id 
            ? await this.client.index({ index, id, body: document, refresh })
            : await this.client.index({ index, body: document, refresh });
          
          return {
            success: true,
            _id: body.body._id,
            _index: body.body._index,
            result: body.body.result,
          };
        },
      })
    );

    this.mcpService.registerTool(
      Tool.create<typeof SearchDocumentsSchema>({
        name: 'search-documents',
        description: 'Search documents in OpenSearch with text or vector similarity',
        inputSchema: SearchDocumentsSchema,
        handler: async (params) => {
          const { index, query, vector_field, vector, k, filters } = params;
          
          let searchBody: any = {
            size: k,
          };

          if (vector && vector_field) {
            // K-NN vector search
            searchBody.query = {
              knn: {
                [vector_field]: {
                  vector: vector,
                  k: k,
                },
              },
            };
          } else if (query) {
            // Text search
            searchBody.query = {
              multi_match: {
                query: query,
                fields: ['*'],
              },
            };
          }

          if (filters) {
            searchBody.query = {
              bool: {
                must: searchBody.query ? [searchBody.query] : [],
                filter: Object.entries(filters).map(([field, value]) => ({
                  term: { [field]: value },
                })),
              },
            };
          }

          const response = await this.client.search({
            index,
            body: searchBody,
          });

          return {
            total: response.body.hits.total.value,
            hits: response.body.hits.hits.map((hit: any) => ({
              _id: hit._id,
              _score: hit._score,
              _source: hit._source,
            })),
          };
        },
      })
    );

    this.mcpService.registerTool(
      Tool.create<typeof CreateIndexSchema>({
        name: 'create-index',
        description: 'Create a new index in OpenSearch',
        inputSchema: CreateIndexSchema,
        handler: async (params) => {
          const { index, mappings, settings } = params;
          
          const body: any = {};
          if (mappings) body.mappings = mappings;
          if (settings) body.settings = settings;
          
          const response = await this.client.indices.create({
            index,
            body: Object.keys(body).length > 0 ? body : undefined,
          });
          
          return {
            success: true,
            acknowledged: response.body.acknowledged,
            index: response.body.index,
          };
        },
      })
    );

    this.mcpService.registerTool(
      Tool.create<typeof DeleteDocumentSchema>({
        name: 'delete-document',
        description: 'Delete a document from OpenSearch',
        inputSchema: DeleteDocumentSchema,
        handler: async (params) => {
          const { index, id, refresh } = params;
          
          const response = await this.client.delete({
            index,
            id,
            refresh,
          });
          
          return {
            success: true,
            result: response.body.result,
            _id: response.body._id,
          };
        },
      })
    );

    this.mcpService.registerTool(
      Tool.create({
        name: 'list-indices',
        description: 'List all indices in OpenSearch',
        inputSchema: z.object({}),
        handler: async () => {
          const response = await this.client.cat.indices({ format: 'json' });
          
          return {
            indices: response.body.map((index: any) => ({
              index: index.index,
              health: index.health,
              status: index.status,
              docs_count: parseInt(index['docs.count'] || '0'),
              store_size: index['store.size'],
            })),
          };
        },
      })
    );

    this.mcpService.registerTool(
      Tool.create({
        name: 'get-cluster-health',
        description: 'Get OpenSearch cluster health status',
        inputSchema: z.object({}),
        handler: async () => {
          const response = await this.client.cluster.health();
          
          return {
            cluster_name: response.body.cluster_name,
            status: response.body.status,
            number_of_nodes: response.body.number_of_nodes,
            active_primary_shards: response.body.active_primary_shards,
            active_shards: response.body.active_shards,
          };
        },
      })
    );
  }
}