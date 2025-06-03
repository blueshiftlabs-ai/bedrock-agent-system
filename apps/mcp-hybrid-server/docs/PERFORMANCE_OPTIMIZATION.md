# Performance Optimization Guide

## Table of Contents
- [Overview](#overview)
- [Performance Baseline](#performance-baseline)
- [Application Optimization](#application-optimization)
- [Database Optimization](#database-optimization)
- [Caching Strategies](#caching-strategies)
- [Memory Management](#memory-management)
- [Network Optimization](#network-optimization)
- [AWS Service Optimization](#aws-service-optimization)
- [Monitoring and Profiling](#monitoring-and-profiling)
- [Scaling Strategies](#scaling-strategies)
- [Performance Testing](#performance-testing)
- [Best Practices](#best-practices)

## Overview

This guide provides comprehensive strategies and techniques for optimizing the performance of the Bedrock Agent System. It covers application-level optimizations, infrastructure tuning, and monitoring approaches to ensure optimal system performance.

### Performance Goals

- **Response Time**: < 2 seconds for API calls
- **Throughput**: 1000+ requests per minute
- **Memory Usage**: < 2GB per container under normal load
- **CPU Utilization**: < 70% average
- **Error Rate**: < 0.1%
- **Availability**: 99.9% uptime

## Performance Baseline

### Baseline Metrics

#### API Response Times
```typescript
// Performance monitoring service
@Injectable()
export class PerformanceMonitoringService {
  private metrics = new Map<string, PerformanceMetric[]>();
  
  recordApiMetric(endpoint: string, duration: number, statusCode: number): void {
    const metric: PerformanceMetric = {
      endpoint,
      duration,
      statusCode,
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };

    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, []);
    }
    
    this.metrics.get(endpoint)!.push(metric);
    
    // Keep only last 1000 measurements per endpoint
    const endpointMetrics = this.metrics.get(endpoint)!;
    if (endpointMetrics.length > 1000) {
      endpointMetrics.splice(0, endpointMetrics.length - 1000);
    }
  }

  getPerformanceReport(endpoint?: string): PerformanceReport {
    const metricsToAnalyze = endpoint 
      ? this.metrics.get(endpoint) || []
      : Array.from(this.metrics.values()).flat();

    if (metricsToAnalyze.length === 0) {
      return { message: 'No metrics available' };
    }

    const durations = metricsToAnalyze.map(m => m.duration);
    const memoryUsages = metricsToAnalyze.map(m => m.memoryUsage.heapUsed);

    return {
      totalRequests: metricsToAnalyze.length,
      averageResponseTime: this.calculateAverage(durations),
      p50ResponseTime: this.calculatePercentile(durations, 50),
      p95ResponseTime: this.calculatePercentile(durations, 95),
      p99ResponseTime: this.calculatePercentile(durations, 99),
      averageMemoryUsage: this.calculateAverage(memoryUsages),
      errorRate: this.calculateErrorRate(metricsToAnalyze),
      throughput: this.calculateThroughput(metricsToAnalyze),
    };
  }
}
```

#### System Resource Monitoring
```typescript
// Resource monitoring service
@Injectable()
export class ResourceMonitoringService {
  private readonly logger = new Logger(ResourceMonitoringService.name);
  
  @Cron('*/30 * * * * *') // Every 30 seconds
  async collectSystemMetrics(): Promise<void> {
    const metrics = {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      eventLoop: this.getEventLoopLag(),
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length,
      heap: v8.getHeapStatistics(),
    };

    await this.storeMetrics(metrics);
    
    // Alert on high resource usage
    if (metrics.memory.heapUsed > 1.5 * 1024 * 1024 * 1024) { // 1.5GB
      this.logger.warn('High memory usage detected', metrics.memory);
    }
  }

  private getEventLoopLag(): number {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e6;
      return lag;
    });
    return 0; // Simplified for example
  }
}
```

## Application Optimization

### Asynchronous Processing

#### Parallel Execution
```typescript
// Optimized workflow execution
@Injectable()
export class OptimizedWorkflowService {
  async executeWorkflowOptimized(config: WorkflowConfig): Promise<WorkflowResult> {
    const startTime = Date.now();
    
    try {
      // Parallel initialization
      const [agentInstances, toolRegistry, memoryContext] = await Promise.all([
        this.initializeAgents(config.agents),
        this.loadToolRegistry(),
        this.loadMemoryContext(config.contextId),
      ]);

      // Batch process workflow steps where possible
      const results = await this.executeBatchedSteps(
        config.steps,
        { agentInstances, toolRegistry, memoryContext }
      );

      return {
        workflowId: config.id,
        results,
        executionTime: Date.now() - startTime,
        optimizations: this.getAppliedOptimizations(),
      };
    } catch (error) {
      this.logger.error('Workflow execution failed', error);
      throw error;
    }
  }

  private async executeBatchedSteps(
    steps: WorkflowStep[],
    context: ExecutionContext
  ): Promise<any[]> {
    // Group steps by dependency level
    const stepGroups = this.groupStepsByDependency(steps);
    const results = [];

    for (const group of stepGroups) {
      // Execute steps in each group in parallel
      const groupResults = await Promise.all(
        group.map(step => this.executeStep(step, context, results))
      );
      results.push(...groupResults);
    }

    return results;
  }

  private groupStepsByDependency(steps: WorkflowStep[]): WorkflowStep[][] {
    // Implement topological sorting for dependency resolution
    const groups: WorkflowStep[][] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (step: WorkflowStep, depth: number = 0): void => {
      if (visiting.has(step.id)) {
        throw new Error(`Circular dependency detected: ${step.id}`);
      }
      
      if (visited.has(step.id)) return;

      visiting.add(step.id);
      
      // Process dependencies first
      step.dependencies?.forEach(depId => {
        const depStep = steps.find(s => s.id === depId);
        if (depStep) visit(depStep, depth + 1);
      });

      visiting.delete(step.id);
      visited.add(step.id);

      // Add to appropriate group
      if (!groups[depth]) groups[depth] = [];
      groups[depth].push(step);
    };

    steps.forEach(step => visit(step));
    return groups.filter(group => group.length > 0);
  }
}
```

#### Stream Processing
```typescript
// Streaming response optimization
@Injectable()
export class StreamingService {
  async streamWorkflowResults(
    workflowId: string,
    response: Response
  ): Promise<void> {
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('Transfer-Encoding', 'chunked');

    const workflow = await this.getWorkflow(workflowId);
    
    for await (const step of this.executeWorkflowSteps(workflow)) {
      const chunk = JSON.stringify(step) + '\n';
      response.write(chunk);
      
      // Optional: add artificial delay for large responses
      if (step.size > 1024 * 1024) { // 1MB
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    response.end();
  }

  private async* executeWorkflowSteps(workflow: Workflow): AsyncGenerator<any> {
    for (const step of workflow.steps) {
      const result = await this.executeStep(step);
      yield {
        stepId: step.id,
        result,
        timestamp: Date.now(),
        size: JSON.stringify(result).length,
      };
    }
  }
}
```

### Code Optimization

#### Efficient Data Structures
```typescript
// Optimized tool registry with efficient lookups
@Injectable()
export class OptimizedToolRegistry {
  private tools = new Map<string, MCPTool>();
  private categoryIndex = new Map<string, Set<string>>();
  private descriptionIndex = new Map<string, Set<string>>();
  private parametersIndex = new Map<string, Set<string>>();

  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
    
    // Build indexes for fast searching
    this.indexToolByCategory(tool);
    this.indexToolByDescription(tool);
    this.indexToolByParameters(tool);
  }

  getRelevantToolsOptimized(query: string, maxResults: number = 10): MCPTool[] {
    const queryTerms = this.tokenizeQuery(query.toLowerCase());
    const scoredResults = new Map<string, number>();

    // Search category index
    queryTerms.forEach(term => {
      this.categoryIndex.get(term)?.forEach(toolName => {
        scoredResults.set(toolName, (scoredResults.get(toolName) || 0) + 10);
      });
    });

    // Search description index
    queryTerms.forEach(term => {
      this.descriptionIndex.get(term)?.forEach(toolName => {
        scoredResults.set(toolName, (scoredResults.get(toolName) || 0) + 5);
      });
    });

    // Search parameters index
    queryTerms.forEach(term => {
      this.parametersIndex.get(term)?.forEach(toolName => {
        scoredResults.set(toolName, (scoredResults.get(toolName) || 0) + 2);
      });
    });

    // Sort by score and return top results
    return Array.from(scoredResults.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxResults)
      .map(([toolName]) => this.tools.get(toolName)!)
      .filter(Boolean);
  }

  private indexToolByCategory(tool: MCPTool): void {
    const terms = this.tokenizeQuery(tool.category.toLowerCase());
    terms.forEach(term => {
      if (!this.categoryIndex.has(term)) {
        this.categoryIndex.set(term, new Set());
      }
      this.categoryIndex.get(term)!.add(tool.name);
    });
  }

  private tokenizeQuery(query: string): string[] {
    return query
      .split(/\s+/)
      .filter(term => term.length > 2)
      .map(term => term.replace(/[^\w]/g, ''));
  }
}
```

#### Memory Pool Management
```typescript
// Object pooling for high-frequency operations
class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;

  constructor(
    createFn: () => T,
    resetFn: (obj: T) => void,
    maxSize: number = 100
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }
}

// Usage example for workflow execution contexts
@Injectable()
export class WorkflowExecutionOptimizer {
  private contextPool = new ObjectPool(
    () => ({
      variables: new Map(),
      results: new Map(),
      metadata: {},
    }),
    (context) => {
      context.variables.clear();
      context.results.clear();
      context.metadata = {};
    },
    50
  );

  async executeWorkflow(config: WorkflowConfig): Promise<any> {
    const context = this.contextPool.acquire();
    
    try {
      // Use the pooled context
      const result = await this.performExecution(config, context);
      return result;
    } finally {
      this.contextPool.release(context);
    }
  }
}
```

## Database Optimization

### DynamoDB Optimization

#### Efficient Query Patterns
```typescript
// Optimized DynamoDB access patterns
@Injectable()
export class OptimizedDynamoDBService {
  async getWorkflowsBatch(workflowIds: string[]): Promise<WorkflowState[]> {
    // Use batch get for multiple items
    const chunks = this.chunkArray(workflowIds, 100); // DynamoDB batch limit
    const results = [];

    for (const chunk of chunks) {
      const batchResponse = await this.dynamodb.batchGet({
        RequestItems: {
          [this.workflowTable]: {
            Keys: chunk.map(id => ({ workflowId: { S: id } })),
            ProjectionExpression: 'workflowId, #status, lastUpdated, #result',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#result': 'result',
            },
          },
        },
      }).promise();

      results.push(...(batchResponse.Responses?.[this.workflowTable] || []));
    }

    return results.map(item => this.unmarshallItem(item));
  }

  async queryWorkflowsByUserOptimized(
    userId: string,
    filters?: QueryFilters
  ): Promise<WorkflowState[]> {
    const params: DynamoDB.QueryInput = {
      TableName: this.workflowTable,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': { S: userId },
      },
      // Project only needed attributes
      ProjectionExpression: 'workflowId, #status, createdAt, #type',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#type': 'type',
      },
      ScanIndexForward: false, // Most recent first
      Limit: filters?.limit || 50,
    };

    // Add filters efficiently
    if (filters?.status) {
      params.FilterExpression = '#status = :status';
      params.ExpressionAttributeValues![':status'] = { S: filters.status };
    }

    // Use pagination for large result sets
    const results = [];
    let lastEvaluatedKey = filters?.lastKey;

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const response = await this.dynamodb.query(params).promise();
      results.push(...(response.Items || []));
      lastEvaluatedKey = response.LastEvaluatedKey;

    } while (lastEvaluatedKey && results.length < (filters?.maxTotal || 1000));

    return results.map(item => this.unmarshallItem(item));
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
```

#### Connection Pooling
```typescript
// DynamoDB connection optimization
@Injectable()
export class DynamoDBConnectionManager {
  private client: DynamoDB;

  constructor() {
    this.client = new DynamoDB({
      region: process.env.AWS_REGION,
      maxRetries: 3,
      retryDelayOptions: {
        customBackoff: (retryCount: number) => {
          return Math.min(1000 * Math.pow(2, retryCount), 5000);
        },
      },
      httpOptions: {
        connectTimeout: 3000,
        timeout: 10000,
        agent: new https.Agent({
          keepAlive: true,
          maxSockets: 50,
          maxFreeSockets: 10,
          timeout: 60000,
          freeSocketTimeout: 30000,
        }),
      },
    });
  }

  async batchWrite(items: any[], tableName: string): Promise<void> {
    const chunks = this.chunkArray(items, 25); // DynamoDB batch write limit
    
    await Promise.all(
      chunks.map(chunk => this.executeBatchWrite(chunk, tableName))
    );
  }

  private async executeBatchWrite(items: any[], tableName: string): Promise<void> {
    let unprocessedItems = items;
    let retryCount = 0;
    const maxRetries = 3;

    while (unprocessedItems.length > 0 && retryCount < maxRetries) {
      const batchRequest = {
        RequestItems: {
          [tableName]: unprocessedItems.map(item => ({
            PutRequest: { Item: item },
          })),
        },
      };

      const response = await this.client.batchWriteItem(batchRequest).promise();
      
      unprocessedItems = response.UnprocessedItems?.[tableName]?.map(
        req => req.PutRequest?.Item
      ).filter(Boolean) || [];

      if (unprocessedItems.length > 0) {
        // Exponential backoff for retries
        await new Promise(resolve => 
          setTimeout(resolve, Math.min(1000 * Math.pow(2, retryCount), 5000))
        );
        retryCount++;
      }
    }

    if (unprocessedItems.length > 0) {
      throw new Error(`Failed to process ${unprocessedItems.length} items after ${maxRetries} retries`);
    }
  }
}
```

## Caching Strategies

### Multi-Level Caching

#### Redis Cache Implementation
```typescript
// Redis-based caching service
@Injectable()
export class RedisCacheService {
  private redis: Redis;
  private compressionThreshold = 1024; // 1KB

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // Connection pooling
      family: 4,
      keepAlive: 30000,
      // Compression for large values
      compression: 'gzip',
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;

      const data = JSON.parse(cached);
      
      // Handle compressed data
      if (data.compressed) {
        const decompressed = await this.decompress(data.value);
        return JSON.parse(decompressed);
      }

      return data;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttl: number = 300
  ): Promise<boolean> {
    try {
      let dataToStore = JSON.stringify(value);
      let compressed = false;

      // Compress large values
      if (dataToStore.length > this.compressionThreshold) {
        dataToStore = await this.compress(dataToStore);
        compressed = true;
      }

      const storeValue = compressed 
        ? JSON.stringify({ compressed: true, value: dataToStore })
        : dataToStore;

      await this.redis.setex(key, ttl, storeValue);
      return true;
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    if (keys.length === 0) return results;

    try {
      const values = await this.redis.mget(...keys);
      
      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          try {
            const parsed = JSON.parse(value);
            results.set(key, parsed);
          } catch (error) {
            this.logger.warn(`Failed to parse cached value for key ${key}`);
          }
        }
      });
    } catch (error) {
      this.logger.error('Cache mget error:', error);
    }

    return results;
  }

  private async compress(data: string): Promise<string> {
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed.toString('base64'));
      });
    });
  }

  private async decompress(data: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const buffer = Buffer.from(data, 'base64');
      zlib.gunzip(buffer, (err, decompressed) => {
        if (err) reject(err);
        else resolve(decompressed.toString());
      });
    });
  }
}
```

#### Application-Level Caching
```typescript
// LRU cache with TTL for application-level caching
class LRUCacheWithTTL<K, V> {
  private cache = new Map<K, { value: V; expiry: number; }>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    
    if (!item) return undefined;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.value;
  }

  set(key: K, value: V, ttlMs: number = 300000): void {
    // Remove oldest items if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Cache decorator for method results
export function Cacheable(ttl: number = 300000) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    const cache = new LRUCacheWithTTL<string, any>();

    descriptor.value = async function (...args: any[]) {
      const key = JSON.stringify(args);
      
      let result = cache.get(key);
      if (result !== undefined) {
        return result;
      }

      result = await method.apply(this, args);
      cache.set(key, result, ttl);
      
      return result;
    };

    return descriptor;
  };
}

// Usage example
@Injectable()
export class AgentService {
  @Cacheable(600000) // 10 minutes
  async getAgentConfiguration(agentType: string): Promise<AgentConfig> {
    // Expensive operation that benefits from caching
    return await this.loadAgentConfiguration(agentType);
  }
}
```

### Cache Warming and Invalidation

```typescript
// Cache warming service
@Injectable()
export class CacheWarmingService {
  constructor(
    private readonly cacheService: RedisCacheService,
    private readonly workflowService: WorkflowService,
  ) {}

  @Cron('0 */6 * * *') // Every 6 hours
  async warmFrequentlyAccessedData(): Promise<void> {
    const tasks = [
      this.warmWorkflowTemplates(),
      this.warmAgentConfigurations(),
      this.warmToolRegistry(),
      this.warmUserPreferences(),
    ];

    await Promise.allSettled(tasks);
  }

  private async warmWorkflowTemplates(): Promise<void> {
    const templates = await this.workflowService.getPopularTemplates();
    
    await Promise.all(
      templates.map(template =>
        this.cacheService.set(
          `workflow:template:${template.id}`,
          template,
          21600 // 6 hours
        )
      )
    );
  }

  private async warmAgentConfigurations(): Promise<void> {
    const agentTypes = ['code-analyzer', 'db-analyzer', 'knowledge-builder'];
    
    await Promise.all(
      agentTypes.map(async type => {
        const config = await this.agentService.getConfiguration(type);
        return this.cacheService.set(
          `agent:config:${type}`,
          config,
          21600
        );
      })
    );
  }

  // Cache invalidation on data changes
  @OnEvent('workflow.template.updated')
  async invalidateWorkflowTemplate(event: { templateId: string }): Promise<void> {
    await this.cacheService.del(`workflow:template:${event.templateId}`);
  }

  @OnEvent('agent.configuration.changed')
  async invalidateAgentConfig(event: { agentType: string }): Promise<void> {
    await this.cacheService.del(`agent:config:${event.agentType}`);
  }
}
```

## Memory Management

### Garbage Collection Optimization

```typescript
// Memory monitoring and optimization
@Injectable()
export class MemoryManager {
  private readonly logger = new Logger(MemoryManager.name);
  private heapSnapshots: any[] = [];

  @Cron('*/5 * * * *') // Every 5 minutes
  async monitorMemoryUsage(): Promise<void> {
    const usage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    // Log memory usage
    this.logger.debug('Memory usage', {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`,
      heapSizeLimit: `${Math.round(heapStats.heap_size_limit / 1024 / 1024)}MB`,
    });

    // Force garbage collection if memory usage is high
    if (usage.heapUsed > heapStats.heap_size_limit * 0.8) {
      this.logger.warn('High memory usage detected, forcing GC');
      if (global.gc) {
        global.gc();
      }
    }

    // Take heap snapshot if memory leak is suspected
    if (this.isMemoryLeakSuspected(usage)) {
      await this.takeHeapSnapshot();
    }
  }

  private isMemoryLeakSuspected(currentUsage: NodeJS.MemoryUsage): boolean {
    const threshold = 1.5 * 1024 * 1024 * 1024; // 1.5GB
    const growthThreshold = 100 * 1024 * 1024; // 100MB growth

    if (currentUsage.heapUsed > threshold) {
      return true;
    }

    // Check for consistent growth pattern
    if (this.heapSnapshots.length >= 3) {
      const recent = this.heapSnapshots.slice(-3);
      const isGrowing = recent.every((snapshot, index) => {
        if (index === 0) return true;
        return snapshot.heapUsed > recent[index - 1].heapUsed + growthThreshold;
      });

      return isGrowing;
    }

    return false;
  }

  private async takeHeapSnapshot(): Promise<void> {
    const snapshot = {
      timestamp: Date.now(),
      heapUsed: process.memoryUsage().heapUsed,
      heapStats: v8.getHeapStatistics(),
    };

    this.heapSnapshots.push(snapshot);

    // Keep only last 10 snapshots
    if (this.heapSnapshots.length > 10) {
      this.heapSnapshots.shift();
    }

    // Write heap dump if available
    if (v8.writeHeapSnapshot) {
      const filename = `heap-${Date.now()}.heapsnapshot`;
      v8.writeHeapSnapshot(filename);
      this.logger.warn(`Heap snapshot written to ${filename}`);
    }
  }

  // Manual memory cleanup for large operations
  async withMemoryCleanup<T>(operation: () => Promise<T>): Promise<T> {
    const initialMemory = process.memoryUsage();
    
    try {
      const result = await operation();
      return result;
    } finally {
      // Force cleanup
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;
      
      if (memoryDelta > 50 * 1024 * 1024) { // 50MB increase
        this.logger.warn(`Large memory allocation detected: ${Math.round(memoryDelta / 1024 / 1024)}MB`);
      }
    }
  }
}
```

### Stream Processing for Large Data

```typescript
// Memory-efficient stream processing
@Injectable()
export class StreamProcessor {
  async processLargeDataset(
    dataSource: AsyncIterable<any>,
    processor: (item: any) => Promise<any>,
    batchSize: number = 100
  ): Promise<void> {
    const batch = [];
    
    for await (const item of dataSource) {
      batch.push(item);
      
      if (batch.length >= batchSize) {
        await this.processBatch(batch, processor);
        batch.length = 0; // Clear array efficiently
        
        // Allow event loop to process other operations
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    // Process remaining items
    if (batch.length > 0) {
      await this.processBatch(batch, processor);
    }
  }

  private async processBatch(
    batch: any[],
    processor: (item: any) => Promise<any>
  ): Promise<void> {
    await Promise.all(
      batch.map(item => this.processWithErrorHandling(item, processor))
    );
  }

  private async processWithErrorHandling(
    item: any,
    processor: (item: any) => Promise<any>
  ): Promise<void> {
    try {
      await processor(item);
    } catch (error) {
      this.logger.error('Error processing item', { item, error });
      // Continue processing other items
    }
  }

  // Memory-efficient file processing
  async* readLargeFileInChunks(
    filePath: string,
    chunkSize: number = 64 * 1024
  ): AsyncGenerator<Buffer> {
    const fileHandle = await fs.open(filePath, 'r');
    
    try {
      let position = 0;
      
      while (true) {
        const { buffer, bytesRead } = await fileHandle.read(
          Buffer.alloc(chunkSize),
          0,
          chunkSize,
          position
        );

        if (bytesRead === 0) break;

        yield buffer.slice(0, bytesRead);
        position += bytesRead;
      }
    } finally {
      await fileHandle.close();
    }
  }
}
```

## Network Optimization

### Connection Pooling

```typescript
// HTTP client with connection pooling
@Injectable()
export class OptimizedHttpClient {
  private agent: https.Agent;
  private axios: AxiosInstance;

  constructor() {
    this.agent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60000,
      freeSocketTimeout: 30000,
      // Optimize for multiple requests to same host
      scheduling: 'lifo',
    });

    this.axios = axios.create({
      httpsAgent: this.agent,
      timeout: 30000,
      // Connection reuse
      headers: {
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=5, max=1000',
      },
    });

    this.setupRequestInterceptors();
    this.setupResponseInterceptors();
  }

  private setupRequestInterceptors(): void {
    this.axios.interceptors.request.use(
      (config) => {
        // Add request timing
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  private setupResponseInterceptors(): void {
    this.axios.interceptors.response.use(
      (response) => {
        // Log timing information
        const duration = Date.now() - response.config.metadata.startTime;
        this.logger.debug(`HTTP ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);
        return response;
      },
      (error) => {
        const duration = Date.now() - error.config?.metadata?.startTime;
        this.logger.error(`HTTP ${error.config?.method?.toUpperCase()} ${error.config?.url} failed - ${duration}ms`, error.message);
        return Promise.reject(error);
      }
    );
  }

  async makeRequest<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.axios.request(config);
    return response.data;
  }

  // Batch multiple requests efficiently
  async batchRequests<T>(
    requests: AxiosRequestConfig[],
    concurrency: number = 10
  ): Promise<T[]> {
    const semaphore = new Semaphore(concurrency);
    
    const requestPromises = requests.map(async (config) => {
      await semaphore.acquire();
      try {
        return await this.makeRequest<T>(config);
      } finally {
        semaphore.release();
      }
    });

    return Promise.all(requestPromises);
  }
}

// Semaphore for controlling concurrency
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      this.permits--;
      resolve();
    }
  }
}
```

### Request Optimization

```typescript
// Request batching and deduplication
@Injectable()
export class RequestOptimizer {
  private pendingRequests = new Map<string, Promise<any>>();
  private batchQueue = new Map<string, any[]>();
  private batchTimers = new Map<string, NodeJS.Timeout>();

  // Request deduplication
  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  // Request batching
  async batchRequest<T>(
    batchKey: string,
    itemKey: string,
    item: any,
    batchProcessor: (items: any[]) => Promise<T[]>,
    batchDelay: number = 10
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Add to batch queue
      if (!this.batchQueue.has(batchKey)) {
        this.batchQueue.set(batchKey, []);
      }

      const queue = this.batchQueue.get(batchKey)!;
      queue.push({ key: itemKey, item, resolve, reject });

      // Set or reset batch timer
      if (this.batchTimers.has(batchKey)) {
        clearTimeout(this.batchTimers.get(batchKey)!);
      }

      const timer = setTimeout(async () => {
        await this.processBatch(batchKey, batchProcessor);
      }, batchDelay);

      this.batchTimers.set(batchKey, timer);
    });
  }

  private async processBatch<T>(
    batchKey: string,
    batchProcessor: (items: any[]) => Promise<T[]>
  ): Promise<void> {
    const queue = this.batchQueue.get(batchKey);
    if (!queue || queue.length === 0) return;

    // Clear the queue and timer
    this.batchQueue.delete(batchKey);
    this.batchTimers.delete(batchKey);

    try {
      const items = queue.map(q => q.item);
      const results = await batchProcessor(items);

      // Resolve individual promises
      queue.forEach((queueItem, index) => {
        queueItem.resolve(results[index]);
      });
    } catch (error) {
      // Reject all promises in the batch
      queue.forEach(queueItem => {
        queueItem.reject(error);
      });
    }
  }
}
```

## AWS Service Optimization

### Bedrock Optimization

```typescript
// Optimized Bedrock client
@Injectable()
export class OptimizedBedrockService {
  private client: BedrockRuntime;
  private requestQueue: Array<{
    params: any;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private processing = false;

  constructor() {
    this.client = new BedrockRuntime({
      region: process.env.AWS_BEDROCK_REGION,
      maxAttempts: 3,
      retryMode: 'adaptive',
      // Optimize for better throughput
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5000,
        socketTimeout: 30000,
        httpsAgent: new https.Agent({
          keepAlive: true,
          maxSockets: 20,
        }),
      }),
    });
  }

  async invokeModelOptimized(params: any): Promise<any> {
    // Use request queuing to prevent throttling
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ params, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.requestQueue.length > 0) {
        const batch = this.requestQueue.splice(0, 5); // Process 5 at a time
        
        await Promise.all(
          batch.map(async ({ params, resolve, reject }) => {
            try {
              const result = await this.client.invokeModel(params);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          })
        );

        // Rate limiting: wait between batches
        if (this.requestQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      this.processing = false;
    }
  }

  // Batch similar requests
  async batchInvokeModel(requests: any[]): Promise<any[]> {
    const results = [];
    const batchSize = 10;

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(params => this.invokeModelOptimized(params))
      );
      
      results.push(...batchResults);
    }

    return results;
  }

  // Model response caching for similar prompts
  @Cacheable(1800000) // 30 minutes
  async invokeModelWithCache(
    modelId: string,
    prompt: string,
    parameters: any
  ): Promise<any> {
    const params = {
      modelId,
      body: JSON.stringify({
        prompt,
        ...parameters,
      }),
    };

    return this.invokeModelOptimized(params);
  }
}
```

### S3 Optimization

```typescript
// Optimized S3 operations
@Injectable()
export class OptimizedS3Service {
  private s3: S3;

  constructor() {
    this.s3 = new S3({
      region: process.env.AWS_REGION,
      // Optimize for better throughput
      maxAttempts: 3,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5000,
        socketTimeout: 30000,
        httpsAgent: new https.Agent({
          keepAlive: true,
          maxSockets: 50,
        }),
      }),
    });
  }

  async uploadLargeFileOptimized(
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string
  ): Promise<string> {
    const fileSize = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body as string);
    
    // Use multipart upload for large files
    if (fileSize > 100 * 1024 * 1024) { // 100MB
      return this.multipartUpload(bucket, key, body, contentType);
    }

    // Regular upload for smaller files
    const params = {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
      // Optimize for frequently accessed files
      StorageClass: 'STANDARD',
    };

    const result = await this.s3.upload(params).promise();
    return result.Location;
  }

  private async multipartUpload(
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string
  ): Promise<string> {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body as string);
    const partSize = 50 * 1024 * 1024; // 50MB parts
    const numParts = Math.ceil(buffer.length / partSize);

    // Initiate multipart upload
    const { UploadId } = await this.s3.createMultipartUpload({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    }).promise();

    try {
      // Upload parts in parallel
      const uploadPromises = Array.from({ length: numParts }, (_, i) => {
        const start = i * partSize;
        const end = Math.min(start + partSize, buffer.length);
        const partBuffer = buffer.slice(start, end);

        return this.s3.uploadPart({
          Bucket: bucket,
          Key: key,
          PartNumber: i + 1,
          UploadId: UploadId!,
          Body: partBuffer,
        }).promise();
      });

      const parts = await Promise.all(uploadPromises);

      // Complete multipart upload
      const { Location } = await this.s3.completeMultipartUpload({
        Bucket: bucket,
        Key: key,
        UploadId: UploadId!,
        MultipartUpload: {
          Parts: parts.map((part, i) => ({
            ETag: part.ETag!,
            PartNumber: i + 1,
          })),
        },
      }).promise();

      return Location!;
    } catch (error) {
      // Abort upload on error
      await this.s3.abortMultipartUpload({
        Bucket: bucket,
        Key: key,
        UploadId: UploadId!,
      }).promise();
      throw error;
    }
  }

  // Batch operations for multiple files
  async batchDownload(
    downloads: Array<{ bucket: string; key: string }>
  ): Promise<Array<{ key: string; data: Buffer }>> {
    const downloadPromises = downloads.map(async ({ bucket, key }) => {
      const { Body } = await this.s3.getObject({
        Bucket: bucket,
        Key: key,
      }).promise();

      return {
        key,
        data: Body as Buffer,
      };
    });

    return Promise.all(downloadPromises);
  }

  // Pre-signed URL generation with caching
  @Cacheable(3600000) // 1 hour
  async getSignedUrl(
    bucket: string,
    key: string,
    expires: number = 3600
  ): Promise<string> {
    return this.s3.getSignedUrl('getObject', {
      Bucket: bucket,
      Key: key,
      Expires: expires,
    });
  }
}
```

## Monitoring and Profiling

### Performance Metrics Collection

```typescript
// Comprehensive performance monitoring
@Injectable()
export class PerformanceMetricsService {
  private metrics: Map<string, MetricData[]> = new Map();
  private readonly metricsRetentionMs = 24 * 60 * 60 * 1000; // 24 hours

  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricArray = this.metrics.get(name)!;
    metricArray.push({
      value,
      timestamp: Date.now(),
      tags: tags || {},
    });

    // Clean old metrics
    this.cleanOldMetrics(name);
  }

  recordTiming(name: string, startTime: number, tags?: Record<string, string>): void {
    const duration = Date.now() - startTime;
    this.recordMetric(name, duration, tags);
  }

  getMetrics(name: string, timeRangeMs?: number): MetricStatistics {
    const metricArray = this.metrics.get(name) || [];
    const cutoff = timeRangeMs ? Date.now() - timeRangeMs : 0;
    const relevantMetrics = metricArray.filter(m => m.timestamp > cutoff);

    if (relevantMetrics.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }

    const values = relevantMetrics.map(m => m.value);
    values.sort((a, b) => a - b);

    return {
      count: values.length,
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      min: values[0],
      max: values[values.length - 1],
      p95: this.calculatePercentile(values, 95),
      p99: this.calculatePercentile(values, 99),
    };
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private cleanOldMetrics(name: string): void {
    const metricArray = this.metrics.get(name)!;
    const cutoff = Date.now() - this.metricsRetentionMs;
    
    const filteredMetrics = metricArray.filter(m => m.timestamp > cutoff);
    this.metrics.set(name, filteredMetrics);
  }

  @Cron('0 */10 * * * *') // Every 10 minutes
  async exportMetrics(): Promise<void> {
    const metricsReport = {
      timestamp: Date.now(),
      metrics: {},
    };

    for (const [name, _] of this.metrics) {
      metricsReport.metrics[name] = this.getMetrics(name, 600000); // Last 10 minutes
    }

    // Export to monitoring system (CloudWatch, Prometheus, etc.)
    await this.sendToMonitoringSystem(metricsReport);
  }

  private async sendToMonitoringSystem(report: any): Promise<void> {
    // Implementation depends on monitoring system
    this.logger.debug('Metrics report generated', report);
  }
}

// Performance decorator for automatic timing
export function PerformanceTracked(metricName?: string) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    const name = metricName || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await method.apply(this, args);
        
        // Record success metric
        this.metricsService?.recordTiming(name, startTime, { status: 'success' });
        
        return result;
      } catch (error) {
        // Record error metric
        this.metricsService?.recordTiming(name, startTime, { status: 'error' });
        throw error;
      }
    };

    return descriptor;
  };
}
```

### Application Profiling

```typescript
// CPU and memory profiling
@Injectable()
export class ApplicationProfiler {
  private readonly logger = new Logger(ApplicationProfiler.name);
  private profilingEnabled = process.env.NODE_ENV === 'development';

  @Cron('0 */30 * * * *') // Every 30 minutes
  async profileApplication(): Promise<void> {
    if (!this.profilingEnabled) return;

    const profile = {
      timestamp: Date.now(),
      memory: this.getMemoryProfile(),
      cpu: await this.getCPUProfile(),
      eventLoop: this.getEventLoopProfile(),
      handles: this.getHandleProfile(),
    };

    await this.saveProfile(profile);
  }

  private getMemoryProfile(): any {
    const usage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    return {
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      heapSizeLimit: heapStats.heap_size_limit,
      totalHeapSize: heapStats.total_heap_size,
      usedHeapSize: heapStats.used_heap_size,
      mallocedMemory: heapStats.malloced_memory,
      peakMallocedMemory: heapStats.peak_malloced_memory,
    };
  }

  private async getCPUProfile(): Promise<any> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime.bigint();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1e6; // Convert to milliseconds

        resolve({
          user: endUsage.user,
          system: endUsage.system,
          duration,
          userPercent: (endUsage.user / duration) * 100,
          systemPercent: (endUsage.system / duration) * 100,
        });
      }, 1000);
    });
  }

  private getEventLoopProfile(): any {
    const async_hooks = require('async_hooks');
    
    return {
      delay: this.measureEventLoopDelay(),
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length,
    };
  }

  private measureEventLoopDelay(): number {
    const start = process.hrtime.bigint();
    
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1e6;
      return delay;
    });

    return 0; // Simplified for example
  }

  private getHandleProfile(): any {
    return {
      handles: process._getActiveHandles().length,
      requests: process._getActiveRequests().length,
    };
  }

  private async saveProfile(profile: any): Promise<void> {
    const filename = `profile-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify(profile, null, 2));
    this.logger.debug(`Performance profile saved: ${filename}`);
  }

  // Manual profiling for specific operations
  async profileOperation<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; profile: any }> {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    const startCPU = process.cpuUsage();

    try {
      const result = await operation();
      
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      const endCPU = process.cpuUsage(startCPU);

      const profile = {
        name,
        duration: Number(endTime - startTime) / 1e6, // milliseconds
        memoryDelta: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
        },
        cpuUsage: {
          user: endCPU.user,
          system: endCPU.system,
        },
      };

      this.logger.debug(`Operation profile: ${name}`, profile);
      
      return { result, profile };
    } catch (error) {
      this.logger.error(`Operation failed: ${name}`, error);
      throw error;
    }
  }
}
```

## Scaling Strategies

### Horizontal Scaling

```typescript
// Load balancing and horizontal scaling
@Injectable()
export class HorizontalScalingService {
  private readonly instances = new Map<string, InstanceInfo>();
  private readonly loadBalancer = new RoundRobinLoadBalancer();

  async registerInstance(instance: InstanceInfo): Promise<void> {
    this.instances.set(instance.id, {
      ...instance,
      lastHeartbeat: Date.now(),
      activeConnections: 0,
    });

    this.logger.log(`Instance registered: ${instance.id}`);
  }

  async deregisterInstance(instanceId: string): Promise<void> {
    this.instances.delete(instanceId);
    this.loadBalancer.removeInstance(instanceId);
    this.logger.log(`Instance deregistered: ${instanceId}`);
  }

  @Cron('*/10 * * * * *') // Every 10 seconds
  async healthCheck(): Promise<void> {
    const now = Date.now();
    const healthyInstances = new Set<string>();

    for (const [instanceId, instance] of this.instances) {
      try {
        const isHealthy = await this.checkInstanceHealth(instance);
        
        if (isHealthy) {
          instance.lastHeartbeat = now;
          healthyInstances.add(instanceId);
        } else {
          throw new Error('Health check failed');
        }
      } catch (error) {
        this.logger.warn(`Instance ${instanceId} failed health check:`, error);
        
        // Remove unhealthy instances after grace period
        if (now - instance.lastHeartbeat > 30000) { // 30 seconds
          await this.deregisterInstance(instanceId);
        }
      }
    }

    // Update load balancer with healthy instances
    this.loadBalancer.updateHealthyInstances(Array.from(healthyInstances));
  }

  async routeRequest(request: any): Promise<string> {
    const instanceId = this.loadBalancer.selectInstance(request);
    
    if (!instanceId) {
      throw new Error('No healthy instances available');
    }

    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.activeConnections++;
    }

    return instanceId;
  }

  async completeRequest(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance && instance.activeConnections > 0) {
      instance.activeConnections--;
    }
  }

  private async checkInstanceHealth(instance: InstanceInfo): Promise<boolean> {
    try {
      const response = await axios.get(`${instance.endpoint}/health`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Load balancer implementations
class RoundRobinLoadBalancer {
  private instances: string[] = [];
  private currentIndex = 0;

  updateHealthyInstances(instances: string[]): void {
    this.instances = instances;
    this.currentIndex = 0;
  }

  selectInstance(request?: any): string | null {
    if (this.instances.length === 0) return null;

    const instance = this.instances[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.instances.length;
    
    return instance;
  }

  removeInstance(instanceId: string): void {
    const index = this.instances.indexOf(instanceId);
    if (index > -1) {
      this.instances.splice(index, 1);
      if (this.currentIndex >= this.instances.length) {
        this.currentIndex = 0;
      }
    }
  }
}
```

### Auto-scaling Based on Metrics

```typescript
// Metric-based auto-scaling
@Injectable()
export class AutoScalingService {
  private readonly scaleUpThreshold = 70; // CPU/Memory percentage
  private readonly scaleDownThreshold = 30;
  private readonly cooldownPeriod = 300000; // 5 minutes
  private lastScaleTime = 0;

  @Cron('*/60 * * * * *') // Every minute
  async evaluateScaling(): Promise<void> {
    const now = Date.now();
    
    // Respect cooldown period
    if (now - this.lastScaleTime < this.cooldownPeriod) {
      return;
    }

    const metrics = await this.gatherMetrics();
    const decision = this.makeScalingDecision(metrics);

    if (decision.action !== 'none') {
      await this.executeScalingAction(decision);
      this.lastScaleTime = now;
    }
  }

  private async gatherMetrics(): Promise<ScalingMetrics> {
    // Gather metrics from all instances
    const instances = await this.getActiveInstances();
    
    const metrics = await Promise.all(
      instances.map(async (instance) => {
        try {
          const response = await axios.get(`${instance.endpoint}/metrics`);
          return response.data;
        } catch (error) {
          this.logger.warn(`Failed to get metrics from ${instance.id}`);
          return null;
        }
      })
    );

    const validMetrics = metrics.filter(Boolean);
    
    if (validMetrics.length === 0) {
      throw new Error('No metrics available for scaling decision');
    }

    return {
      avgCpuUsage: this.calculateAverage(validMetrics.map(m => m.cpu)),
      avgMemoryUsage: this.calculateAverage(validMetrics.map(m => m.memory)),
      avgResponseTime: this.calculateAverage(validMetrics.map(m => m.responseTime)),
      totalRequests: validMetrics.reduce((sum, m) => sum + m.requests, 0),
      instanceCount: validMetrics.length,
    };
  }

  private makeScalingDecision(metrics: ScalingMetrics): ScalingDecision {
    const resourceUsage = Math.max(metrics.avgCpuUsage, metrics.avgMemoryUsage);
    
    if (resourceUsage > this.scaleUpThreshold) {
      return {
        action: 'scale_up',
        reason: `High resource usage: ${resourceUsage}%`,
        targetCount: Math.min(metrics.instanceCount + 2, 20), // Max 20 instances
      };
    }
    
    if (resourceUsage < this.scaleDownThreshold && metrics.instanceCount > 2) {
      return {
        action: 'scale_down',
        reason: `Low resource usage: ${resourceUsage}%`,
        targetCount: Math.max(metrics.instanceCount - 1, 2), // Min 2 instances
      };
    }

    return { action: 'none', reason: 'Metrics within normal range' };
  }

  private async executeScalingAction(decision: ScalingDecision): Promise<void> {
    this.logger.log(`Executing scaling action: ${decision.action}`, decision);

    try {
      switch (decision.action) {
        case 'scale_up':
          await this.scaleUp(decision.targetCount!);
          break;
        case 'scale_down':
          await this.scaleDown(decision.targetCount!);
          break;
      }
    } catch (error) {
      this.logger.error('Scaling action failed:', error);
    }
  }

  private async scaleUp(targetCount: number): Promise<void> {
    // Implementation depends on deployment platform (ECS, Kubernetes, etc.)
    await this.updateServiceDesiredCount(targetCount);
  }

  private async scaleDown(targetCount: number): Promise<void> {
    // Gracefully terminate excess instances
    await this.updateServiceDesiredCount(targetCount);
  }

  private calculateAverage(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}
```

## Performance Testing

### Load Testing

```typescript
// Automated performance testing
@Injectable()
export class PerformanceTestingService {
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const results: TestResult[] = [];
    const startTime = Date.now();

    // Warmup phase
    await this.warmupPhase(config);

    // Ramp-up phase
    for (let concurrency = 1; concurrency <= config.maxConcurrency; concurrency++) {
      const phaseResult = await this.runTestPhase(config, concurrency);
      results.push(phaseResult);

      // Check if we've hit performance degradation
      if (phaseResult.avgResponseTime > config.maxResponseTime) {
        this.logger.warn(`Performance degradation detected at concurrency: ${concurrency}`);
        break;
      }
    }

    return {
      testDuration: Date.now() - startTime,
      maxStableConcurrency: this.findMaxStableConcurrency(results, config),
      results,
      summary: this.generateSummary(results),
    };
  }

  private async warmupPhase(config: LoadTestConfig): Promise<void> {
    this.logger.log('Starting warmup phase...');
    
    const warmupRequests = Math.min(config.maxConcurrency, 10);
    await this.sendConcurrentRequests(config, warmupRequests, 30); // 30 seconds warmup
    
    // Wait for systems to stabilize
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
  }

  private async runTestPhase(
    config: LoadTestConfig,
    concurrency: number
  ): Promise<TestResult> {
    this.logger.log(`Testing with concurrency: ${concurrency}`);
    
    const metrics = await this.sendConcurrentRequests(
      config,
      concurrency,
      config.testDuration
    );

    return {
      concurrency,
      ...metrics,
    };
  }

  private async sendConcurrentRequests(
    config: LoadTestConfig,
    concurrency: number,
    durationSeconds: number
  ): Promise<RequestMetrics> {
    const results: number[] = [];
    const errors: string[] = [];
    const startTime = Date.now();
    const endTime = startTime + (durationSeconds * 1000);

    const workers = Array.from({ length: concurrency }, () =>
      this.runWorker(config, endTime, results, errors)
    );

    await Promise.all(workers);

    return this.calculateMetrics(results, errors, Date.now() - startTime);
  }

  private async runWorker(
    config: LoadTestConfig,
    endTime: number,
    results: number[],
    errors: string[]
  ): Promise<void> {
    while (Date.now() < endTime) {
      try {
        const requestStart = Date.now();
        await this.makeTestRequest(config);
        const responseTime = Date.now() - requestStart;
        
        results.push(responseTime);
        
        // Add small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (error) {
        errors.push(error.message);
      }
    }
  }

  private async makeTestRequest(config: LoadTestConfig): Promise<void> {
    const response = await axios({
      method: config.method || 'GET',
      url: config.url,
      data: config.payload,
      headers: config.headers,
      timeout: config.timeout || 30000,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private calculateMetrics(
    results: number[],
    errors: string[],
    totalDuration: number
  ): RequestMetrics {
    if (results.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: errors.length,
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 1,
      };
    }

    const sortedResults = [...results].sort((a, b) => a - b);
    
    return {
      totalRequests: results.length + errors.length,
      successfulRequests: results.length,
      failedRequests: errors.length,
      avgResponseTime: results.reduce((sum, time) => sum + time, 0) / results.length,
      minResponseTime: sortedResults[0],
      maxResponseTime: sortedResults[sortedResults.length - 1],
      p95ResponseTime: this.calculatePercentile(sortedResults, 95),
      p99ResponseTime: this.calculatePercentile(sortedResults, 99),
      requestsPerSecond: (results.length / totalDuration) * 1000,
      errorRate: errors.length / (results.length + errors.length),
    };
  }

  private findMaxStableConcurrency(
    results: TestResult[],
    config: LoadTestConfig
  ): number {
    for (let i = results.length - 1; i >= 0; i--) {
      const result = results[i];
      if (
        result.avgResponseTime <= config.maxResponseTime &&
        result.errorRate <= config.maxErrorRate
      ) {
        return result.concurrency;
      }
    }
    return 1;
  }
}
```

## Best Practices

### Performance Optimization Checklist

#### Application Level
- [ ] **Asynchronous Processing**: Use Promise.all() for parallel operations
- [ ] **Efficient Data Structures**: Use Map/Set instead of objects/arrays for lookups
- [ ] **Memory Management**: Implement object pooling for frequently created objects
- [ ] **Stream Processing**: Use streams for large data processing
- [ ] **Error Handling**: Implement circuit breakers for external service calls

#### Database Level
- [ ] **Query Optimization**: Use batch operations and efficient query patterns
- [ ] **Connection Pooling**: Implement connection pooling for database clients
- [ ] **Indexing**: Ensure proper indexes on frequently queried fields
- [ ] **Pagination**: Implement pagination for large result sets
- [ ] **Caching**: Cache frequently accessed data

#### Network Level
- [ ] **HTTP Keep-Alive**: Enable connection reuse
- [ ] **Request Batching**: Batch multiple requests where possible
- [ ] **Compression**: Enable gzip compression for responses
- [ ] **CDN**: Use CDN for static assets
- [ ] **Rate Limiting**: Implement rate limiting to prevent abuse

#### AWS Services
- [ ] **Service Limits**: Monitor and request limit increases as needed
- [ ] **Regions**: Use services in the same region to reduce latency
- [ ] **Instance Types**: Choose appropriate instance types for workload
- [ ] **Auto Scaling**: Configure auto-scaling based on metrics
- [ ] **Cost Optimization**: Use appropriate storage classes and reserved instances

### Performance Monitoring Checklist

- [ ] **Response Time Monitoring**: Track API response times
- [ ] **Resource Usage**: Monitor CPU, memory, and disk usage
- [ ] **Error Rate Tracking**: Monitor error rates and types
- [ ] **Throughput Metrics**: Track requests per second
- [ ] **Database Performance**: Monitor query performance and connection pools
- [ ] **Cache Hit Rates**: Monitor cache effectiveness
- [ ] **External Service Latency**: Track third-party service performance

This comprehensive performance optimization guide provides the foundation for maintaining high performance in the Bedrock Agent System. Regular monitoring, testing, and optimization are essential for continued performance excellence.