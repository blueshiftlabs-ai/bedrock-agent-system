import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';

@Injectable()
export class ServiceDiscoveryService {
  private readonly logger = new Logger(ServiceDiscoveryService.name);
  private readonly serviceDiscovery: AWS.ServiceDiscovery;
  private readonly serviceCache = new Map<string, { endpoint: string; lastUpdated: number }>();
  private readonly cacheTimeout = 60000; // 1 minute cache

  constructor(private readonly configService: ConfigService) {
    this.serviceDiscovery = new AWS.ServiceDiscovery({
      region: this.configService.get('AWS_REGION'),
    });
  }

  async getServiceEndpoint(serviceName: string): Promise<string | null> {
    // Check cache first
    const cached = this.serviceCache.get(serviceName);
    if (cached && Date.now() - cached.lastUpdated < this.cacheTimeout) {
      return cached.endpoint;
    }

    try {
      // Get namespace
      const namespace = this.configService.get('SERVICE_DISCOVERY_NAMESPACE');
      
      // Use DNS-based service discovery for ECS
      const serviceUrl = `http://${serviceName}.${namespace}`;
      
      // For development, you might want to use environment variables
      const servicePort = this.getServicePort(serviceName);
      const endpoint = `${serviceUrl}:${servicePort}`;

      // Cache the result
      this.serviceCache.set(serviceName, {
        endpoint,
        lastUpdated: Date.now(),
      });

      this.logger.debug(`Service discovery: ${serviceName} -> ${endpoint}`);
      return endpoint;

    } catch (error: any) {
      this.logger.error(`Failed to discover service ${serviceName}:`, error);
      
      // Fallback to environment variables or defaults
      return this.getFallbackEndpoint(serviceName);
    }
  }

  private getServicePort(serviceName: string): number {
    const portMap: Record<string, number> = {
      'agents-service': 3001,
      'tools-service': 3002,
      'workflows-service': 3003,
    };
    
    return portMap[serviceName] || 3000;
  }

  private getFallbackEndpoint(serviceName: string): string | null {
    // Fallback to environment variables for local development
    const envVar = `${serviceName.toUpperCase().replace('-', '_')}_URL`;
    const fallback = this.configService.get(envVar);
    
    if (fallback) {
      this.logger.warn(`Using fallback endpoint for ${serviceName}: ${fallback}`);
      return fallback;
    }

    // Default fallback for local development
    if (this.configService.get('NODE_ENV') === 'development') {
      const port = this.getServicePort(serviceName);
      const fallbackUrl = `http://localhost:${port}`;
      this.logger.warn(`Using default fallback for ${serviceName}: ${fallbackUrl}`);
      return fallbackUrl;
    }

    return null;
  }

  async refreshServiceCache(): Promise<void> {
    this.logger.debug('Refreshing service discovery cache');
    this.serviceCache.clear();
  }

  getServiceHealth(): Record<string, any> {
    const services = Array.from(this.serviceCache.entries()).map(([name, data]) => ({
      name,
      endpoint: data.endpoint,
      lastUpdated: new Date(data.lastUpdated).toISOString(),
      age: Date.now() - data.lastUpdated,
    }));

    return {
      cacheSize: this.serviceCache.size,
      cacheTimeout: this.cacheTimeout,
      services,
    };
  }
}