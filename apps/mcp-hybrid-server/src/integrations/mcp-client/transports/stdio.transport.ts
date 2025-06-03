import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { MCPTransport, MCPRequest, MCPNotification, MCPResponse } from '../types/mcp-protocol.types';

export interface StdioTransportOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export class StdioTransport extends EventEmitter implements MCPTransport {
  private readonly logger = new Logger(StdioTransport.name);
  private process: ChildProcess | null = null;
  private buffer = '';
  private messageHandlers: Array<(message: MCPResponse | MCPNotification) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private closeHandlers: Array<() => void> = [];

  constructor(private readonly options: StdioTransportOptions) {
    super();
  }

  async connect(): Promise<void> {
    this.logger.log(`Starting MCP server process: ${this.options.command}`);

    try {
      this.process = spawn(this.options.command, this.options.args || [], {
        env: { ...process.env, ...this.options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.process.stdout || !this.process.stdin) {
        throw new Error('Failed to create process stdio streams');
      }

      // Handle stdout
      this.process.stdout.on('data', (data: Buffer) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      // Handle stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        this.logger.warn(`MCP server stderr: ${data.toString()}`);
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        this.logger.log(`MCP server process exited with code ${code}, signal ${signal}`);
        this.handleClose();
      });

      // Handle process error
      this.process.on('error', (error) => {
        this.logger.error('MCP server process error:', error);
        this.handleError(error);
      });

    } catch (error) {
      this.logger.error('Failed to start MCP server process:', error);
      throw error;
    }
  }

  async send(message: MCPRequest | MCPNotification): Promise<void> {
    if (!this.process || !this.process.stdin) {
      throw new Error('Transport not connected');
    }

    const jsonMessage = JSON.stringify(message);
    const fullMessage = `Content-Length: ${Buffer.byteLength(jsonMessage)}\r\n\r\n${jsonMessage}`;

    return new Promise((resolve, reject) => {
      this.process!.stdin!.write(fullMessage, (error) => {
        if (error) {
          this.logger.error('Failed to send message:', error);
          reject(error);
        } else {
          resolve();
        }
      });
    });
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
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  private processBuffer(): void {
    while (true) {
      // Look for Content-Length header
      const headerEndIndex = this.buffer.indexOf('\r\n\r\n');
      if (headerEndIndex === -1) {
        break; // No complete header yet
      }

      const header = this.buffer.substring(0, headerEndIndex);
      const contentLengthMatch = header.match(/Content-Length: (\d+)/);
      
      if (!contentLengthMatch) {
        this.logger.error('Invalid message header: missing Content-Length');
        this.buffer = this.buffer.substring(headerEndIndex + 4);
        continue;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const messageStart = headerEndIndex + 4;
      
      if (this.buffer.length < messageStart + contentLength) {
        break; // Complete message not yet received
      }

      const messageContent = this.buffer.substring(messageStart, messageStart + contentLength);
      this.buffer = this.buffer.substring(messageStart + contentLength);

      try {
        const message = JSON.parse(messageContent) as MCPResponse | MCPNotification;
        this.handleMessage(message);
      } catch (error) {
        this.logger.error('Failed to parse message:', error);
      }
    }
  }

  private handleMessage(message: MCPResponse | MCPNotification): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
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
      } catch (error) {
        this.logger.error('Close handler error:', error);
      }
    });
  }
}