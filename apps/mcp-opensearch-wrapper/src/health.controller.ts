import { Controller, Get } from '@nestjs/common';
import { OpenSearchService } from './opensearch.service';

@Controller('opensearch/health')
export class HealthController {
  constructor(private readonly openSearchService: OpenSearchService) {}

  @Get()
  async getHealth() {
    try {
      const clusterHealth = await this.openSearchService.getClusterHealthInternal();
      
      return {
        status: 'healthy',
        service: 'opensearch-mcp',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        opensearch: {
          connected: true,
          cluster_name: clusterHealth.cluster_name,
          status: clusterHealth.status,
          nodes: clusterHealth.number_of_nodes,
        },
        tools: {
          available: 6,
          names: [
            'index-document',
            'search-documents', 
            'create-index',
            'delete-document',
            'list-indices',
            'get-cluster-health'
          ]
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'opensearch-mcp',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        opensearch: {
          connected: false,
          error: error.message,
        },
        tools: {
          available: 6,
          status: 'disabled - opensearch unavailable'
        }
      };
    }
  }
}