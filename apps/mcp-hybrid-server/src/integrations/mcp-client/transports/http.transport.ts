import { Logger } from '@nestjs/common';
import { MCPTransport, MCPRequest, MCPNotification, MCPResponse } from '../types/mcp-protocol.types';

export interface HttpTransportOptions {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export class HttpTransport implements MCPTransport {
  private readonly logger = new Logger(HttpTransport.name);
  private messageHandlers: Array<(message: MCPResponse | MCPNotification) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private requestCounter = 0;

  constructor(private readonly options: HttpTransportOptions) {}

  async send(message: MCPRequest | MCPNotification): Promise<void> {
    try {
      const response = await fetch(this.options.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.options.headers,
        },
        body: JSON.stringify(message),
        signal: this.options.timeout ? AbortSignal.timeout(this.options.timeout) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // For HTTP transport, we get immediate response
      const responseText = await response.text();
      if (responseText) {
        const responseMessage = JSON.parse(responseText) as MCPResponse;
        this.handleMessage(responseMessage);
      }
    } catch (error: any) {
      this.logger.error('HTTP transport error:', error);
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  onMessage(handler: (message: MCPResponse | MCPNotification) => void): void {
    this.messageHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  async close(): Promise<void> {
    this.handleClose();
  }

  private handleMessage(message: MCPResponse | MCPNotification): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error: any) {
        this.logger.error('Message handler error:', error);
      }
    });
  }

  private handleError(error: Error): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (err) {
        this.logger.error('Error handler error:', err);
      }
    });
  }

  private handleClose(): void {
    this.closeHandlers.forEach(handler => {
      try {
        handler();
      } catch (error: any) {
        this.logger.error('Close handler error:', error);
      }
    });
  }
}