import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { ConfigManager } from '../utils/config';
import { APIResponse, WebSocketMessage } from '../types';

export class APIClient extends EventEmitter {
  private client!: AxiosInstance;
  private wsClient?: WebSocket;
  private config: ConfigManager;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  constructor() {
    super();
    this.config = ConfigManager.getInstance();
    this.setupHttpClient();
  }

  private setupHttpClient(): void {
    const serverConfig = this.config.get<any>('server');
    
    this.client = axios.create({
      baseURL: `${serverConfig.url}/api/v1`,
      timeout: serverConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'mcp-cli/1.0.0'
      }
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        this.emit('request', { url: config.url, method: config.method });
        return config;
      },
      (error) => {
        this.emit('error', { type: 'request', error });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.emit('response', { 
          url: response.config.url, 
          status: response.status,
          duration: Date.now() - (response.config as any).startTime
        });
        return response;
      },
      async (error) => {
        if (error.response?.status === 401) {
          this.emit('unauthorized');
        }
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          this.emit('connection-error', error);
        }

        // Retry logic
        const config = error.config;
        if (!config || config.__retryCount >= this.config.get<number>('server.retries')) {
          return Promise.reject(error);
        }

        config.__retryCount = config.__retryCount || 0;
        config.__retryCount++;

        const delay = Math.pow(2, config.__retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        return this.client(config);
      }
    );
  }

  // HTTP Methods
  async get<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    try {
      const response = await this.client.get(endpoint, config);
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.headers['x-request-id']
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async post<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    try {
      const response = await this.client.post(endpoint, data, config);
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.headers['x-request-id']
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async put<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    try {
      const response = await this.client.put(endpoint, data, config);
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.headers['x-request-id']
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async delete<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    try {
      const response = await this.client.delete(endpoint, config);
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
        requestId: response.headers['x-request-id']
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  // WebSocket Methods
  connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const serverUrl = this.config.get<string>('server.url');
      const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';

      this.wsClient = new WebSocket(wsUrl);

      this.wsClient.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('ws-connected');
        resolve();
      });

      this.wsClient.on('message', (data: WebSocket.Data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.emit('ws-message', message);
          this.emit(`ws-${message.type}`, message.data);
        } catch (error: any) {
          this.emit('ws-error', { type: 'parse', error });
        }
      });

      this.wsClient.on('close', () => {
        this.isConnected = false;
        this.emit('ws-disconnected');
        this.handleReconnect();
      });

      this.wsClient.on('error', (error) => {
        this.emit('ws-error', { type: 'connection', error });
        reject(error);
      });

      // Timeout handling
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, this.config.get<number>('server.timeout'));
    });
  }

  disconnectWebSocket(): void {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = undefined;
    }
    this.isConnected = false;
  }

  sendWebSocketMessage(message: any): void {
    if (this.wsClient && this.isConnected) {
      this.wsClient.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket not connected');
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      this.emit('ws-reconnecting', { attempt: this.reconnectAttempts, delay });
      
      setTimeout(() => {
        this.connectWebSocket().catch((error) => {
          this.emit('ws-error', { type: 'reconnect', error });
        });
      }, delay);
    } else {
      this.emit('ws-max-reconnects-reached');
    }
  }

  // Health Check
  async healthCheck(): Promise<APIResponse<any>> {
    return this.get('/health');
  }

  async serverStatus(): Promise<APIResponse<any>> {
    return this.get('/status');
  }

  // Server Management
  async startServer(): Promise<APIResponse<any>> {
    return this.post('/server/start');
  }

  async stopServer(): Promise<APIResponse<any>> {
    return this.post('/server/stop');
  }

  async restartServer(): Promise<APIResponse<any>> {
    return this.post('/server/restart');
  }

  async getServerLogs(options?: { lines?: number; follow?: boolean; filter?: string }): Promise<APIResponse<any>> {
    const params = new URLSearchParams();
    if (options?.lines) params.append('lines', options.lines.toString());
    if (options?.follow) params.append('follow', 'true');
    if (options?.filter) params.append('filter', options.filter);
    
    return this.get(`/server/logs?${params.toString()}`);
  }

  // Agent Management
  async getAgents(): Promise<APIResponse<any>> {
    return this.get('/agents');
  }

  async getAgent(id: string): Promise<APIResponse<any>> {
    return this.get(`/agents/${id}`);
  }

  async runAgent(id: string, input: any): Promise<APIResponse<any>> {
    return this.post(`/agents/${id}/run`, input);
  }

  async getAgentStatus(id: string): Promise<APIResponse<any>> {
    return this.get(`/agents/${id}/status`);
  }

  // Workflow Management
  async getWorkflows(): Promise<APIResponse<any>> {
    return this.get('/workflows');
  }

  async getWorkflow(id: string): Promise<APIResponse<any>> {
    return this.get(`/workflows/${id}`);
  }

  async startWorkflow(id: string, input: any): Promise<APIResponse<any>> {
    return this.post(`/workflows/${id}/start`, input);
  }

  async stopWorkflow(id: string): Promise<APIResponse<any>> {
    return this.post(`/workflows/${id}/stop`);
  }

  async getWorkflowStatus(id: string): Promise<APIResponse<any>> {
    return this.get(`/workflows/${id}/status`);
  }

  // Tool Management
  async getTools(): Promise<APIResponse<any>> {
    return this.get('/tools');
  }

  async getTool(id: string): Promise<APIResponse<any>> {
    return this.get(`/tools/${id}`);
  }

  async executeTool(id: string, params: any): Promise<APIResponse<any>> {
    return this.post(`/tools/${id}/execute`, params);
  }

  async getToolSchema(id: string): Promise<APIResponse<any>> {
    return this.get(`/tools/${id}/schema`);
  }

  // Process Management
  async getProcesses(): Promise<APIResponse<any>> {
    return this.get('/processes');
  }

  async getProcess(pid: number): Promise<APIResponse<any>> {
    return this.get(`/processes/${pid}`);
  }

  async killProcess(pid: number, signal?: string): Promise<APIResponse<any>> {
    return this.post(`/processes/${pid}/kill`, { signal: signal || 'SIGTERM' });
  }

  // Configuration Management
  async getConfig(): Promise<APIResponse<any>> {
    return this.get('/config');
  }

  async setConfig(key: string, value: any): Promise<APIResponse<any>> {
    return this.put('/config', { key, value });
  }

  async exportConfig(): Promise<APIResponse<any>> {
    return this.get('/config/export');
  }

  async importConfig(config: any): Promise<APIResponse<any>> {
    return this.post('/config/import', config);
  }

  // Monitoring
  async getMetrics(): Promise<APIResponse<any>> {
    return this.get('/metrics');
  }

  async getAlerts(): Promise<APIResponse<any>> {
    return this.get('/alerts');
  }

  // Connection Management
  async getConnections(): Promise<APIResponse<any>> {
    return this.get('/connections');
  }

  async testConnection(id: string): Promise<APIResponse<any>> {
    return this.post(`/connections/${id}/test`);
  }

  // Error Handling
  private handleError(error: any): APIResponse<never> {
    let message = 'Unknown error';
    
    if (error.response) {
      // Server responded with error status
      message = error.response.data?.message || error.response.statusText || message;
    } else if (error.request) {
      // Request was made but no response received
      message = 'No response from server';
    } else {
      // Error in request setup
      message = error.message || message;
    }

    return {
      success: false,
      error: message,
      timestamp: new Date()
    };
  }

  // Utility Methods
  isServerReachable(): Promise<boolean> {
    return this.healthCheck()
      .then(response => response.success)
      .catch(() => false);
  }

  getConnectionStatus(): {
    http: boolean;
    websocket: boolean;
  } {
    return {
      http: true, // We'll assume HTTP is working if we can create requests
      websocket: this.isConnected
    };
  }

  dispose(): void {
    this.disconnectWebSocket();
    this.removeAllListeners();
  }
}