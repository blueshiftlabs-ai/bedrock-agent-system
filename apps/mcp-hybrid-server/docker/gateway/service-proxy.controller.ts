import { Controller, All, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ServiceProxyService } from './service-proxy.service';

@Controller()
export class ServiceProxyController {
  private readonly logger = new Logger(ServiceProxyController.name);

  constructor(private readonly serviceProxyService: ServiceProxyService) {}

  @All('agents/*')
  async proxyToAgents(@Req() req: Request, @Res() res: Response) {
    return this.serviceProxyService.proxyRequest('agents-service', req, res);
  }

  @All('tools/*')
  async proxyToTools(@Req() req: Request, @Res() res: Response) {
    return this.serviceProxyService.proxyRequest('tools-service', req, res);
  }

  @All('workflows/*')
  async proxyToWorkflows(@Req() req: Request, @Res() res: Response) {
    return this.serviceProxyService.proxyRequest('workflows-service', req, res);
  }
}