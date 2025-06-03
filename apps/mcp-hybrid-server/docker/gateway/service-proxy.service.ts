import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { ServiceDiscoveryService } from './service-discovery.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ServiceProxyService {
  private readonly logger = new Logger(ServiceProxyService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly serviceDiscovery: ServiceDiscoveryService,
  ) {}

  async proxyRequest(serviceName: string, req: Request, res: Response): Promise<void> {
    try {
      // Get service endpoint from service discovery
      const serviceEndpoint = await this.serviceDiscovery.getServiceEndpoint(serviceName);
      
      if (!serviceEndpoint) {
        throw new HttpException(`Service ${serviceName} not found`, HttpStatus.SERVICE_UNAVAILABLE);
      }

      // Construct target URL
      const targetUrl = `${serviceEndpoint}${req.url}`;
      
      this.logger.debug(`Proxying ${req.method} ${req.url} to ${targetUrl}`);

      // Prepare headers (exclude host and other problematic headers)
      const headers = { ...req.headers };
      delete headers.host;
      delete headers['content-length'];

      // Make the request to the target service
      const response = await firstValueFrom(
        this.httpService.request({
          method: req.method as any,
          url: targetUrl,
          data: req.body,
          headers,
          params: req.query,
          timeout: 30000,
          maxRedirects: 0,
          validateStatus: () => true, // Don't throw on HTTP error status
        })
      );

      // Copy response headers
      Object.entries(response.headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== 'transfer-encoding') {
          res.set(key, value as string);
        }
      });

      // Send response
      res.status(response.status).send(response.data);

    } catch (error) {
      this.logger.error(`Error proxying request to ${serviceName}:`, error);
      
      if (error.response) {
        // HTTP error from target service
        res.status(error.response.status).json({
          error: 'Service Error',
          message: error.response.data?.message || 'Internal service error',
          statusCode: error.response.status,
        });
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        // Connection error
        res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          error: 'Service Unavailable',
          message: `Service ${serviceName} is not available`,
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        });
      } else {
        // Other errors
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: 'Proxy Error',
          message: 'Failed to proxy request',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        });
      }
    }
  }
}