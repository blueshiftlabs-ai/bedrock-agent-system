import { ToolMetadata } from '../interfaces/tool-management.interface';
import * as crypto from 'crypto';

/**
 * Example tool demonstrating the dynamic tool interface
 * This tool performs text analysis with configurable options
 */
export class ExampleAnalysisTool {
  static createMetadata(): ToolMetadata {
    const toolContent = `
      // Example tool implementation
      export async function execute(params, context) {
        const { text, options = {} } = params;
        
        if (!text || typeof text !== 'string') {
          throw new Error('Text parameter is required and must be a string');
        }
        
        const analysis = {
          text,
          wordCount: text.split(/\\s+/).length,
          characterCount: text.length,
          sentenceCount: text.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
          paragraphCount: text.split(/\\n\\s*\\n/).length,
          readingTime: Math.ceil(text.split(/\\s+/).length / 200), // ~200 WPM
          sentiment: analyzeSentiment(text),
          keywords: extractKeywords(text, options.maxKeywords || 10),
          timestamp: new Date().toISOString(),
          executionContext: {
            userId: context?.userId,
            requestId: context?.requestId
          }
        };
        
        return analysis;
      }
      
      function analyzeSentiment(text) {
        // Simple sentiment analysis (in production, use a proper library)
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
        const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing'];
        
        const words = text.toLowerCase().split(/\\s+/);
        const positive = words.filter(word => positiveWords.includes(word)).length;
        const negative = words.filter(word => negativeWords.includes(word)).length;
        
        if (positive > negative) return 'positive';
        if (negative > positive) return 'negative';
        return 'neutral';
      }
      
      function extractKeywords(text, maxKeywords) {
        // Simple keyword extraction (in production, use TF-IDF or similar)
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        const words = text.toLowerCase()
          .replace(/[^\\w\\s]/g, '')
          .split(/\\s+/)
          .filter(word => word.length > 3 && !stopWords.includes(word));
        
        const frequency = {};
        words.forEach(word => {
          frequency[word] = (frequency[word] || 0) + 1;
        });
        
        return Object.entries(frequency)
          .sort(([,a], [,b]) => b - a)
          .slice(0, maxKeywords)
          .map(([word, count]) => ({ word, count }));
      }
    `;

    const checksum = crypto.createHash('sha256').update(toolContent).digest('hex');

    return {
      id: 'example-text-analysis-tool',
      name: 'text-analysis-tool',
      description: 'Analyzes text content to extract insights including word count, sentiment, keywords, and reading time',
      category: 'analysis',
      version: { major: 1, minor: 2, patch: 0 },
      author: 'Dynamic Tools Team',
      license: 'MIT',
      repository: 'https://github.com/example/text-analysis-tool',
      homepage: 'https://example.com/tools/text-analysis',
      keywords: ['text', 'analysis', 'nlp', 'sentiment', 'keywords'],
      dependencies: [],
      permissions: [
        {
          type: 'read',
          resource: 'text-content',
          description: 'Read and process text content'
        }
      ],
      parameters: {
        type: 'object',
        required: ['text'],
        properties: {
          text: {
            type: 'string',
            description: 'The text content to analyze',
            required: true
          },
          options: {
            type: 'object',
            description: 'Analysis options',
            required: false,
            properties: {
              maxKeywords: {
                type: 'number',
                description: 'Maximum number of keywords to extract',
                default: 10
              },
              includeSentiment: {
                type: 'boolean',
                description: 'Whether to include sentiment analysis',
                default: true
              }
            }
          }
        }
      },
      execute: async (params: any, context?: any) => {
        const { text, options = {} } = params;
        
        if (!text || typeof text !== 'string') {
          throw new Error('Text parameter is required and must be a string');
        }
        
        const analysis = {
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), // Truncate for response
          wordCount: text.split(/\s+/).length,
          characterCount: text.length,
          sentenceCount: text.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
          paragraphCount: text.split(/\n\s*\n/).length,
          readingTime: Math.ceil(text.split(/\s+/).length / 200), // ~200 WPM
          sentiment: ExampleAnalysisTool.analyzeSentiment(text),
          keywords: ExampleAnalysisTool.extractKeywords(text, options.maxKeywords || 10),
          timestamp: new Date().toISOString(),
          executionContext: {
            userId: context?.userId,
            requestId: context?.requestId
          }
        };
        
        return analysis;
      },
      timeout: 15000,
      retryable: true,
      cacheable: false,
      healthCheck: {
        enabled: true,
        interval: 60000, // 1 minute
        timeout: 5000,   // 5 seconds
        retries: 3,
        healthCheck: async () => {
          try {
            // Test the tool with a simple input
            const testResult = await ExampleAnalysisTool.prototype.constructor.prototype.execute({
              text: 'This is a simple health check test.'
            });
            
            return {
              status: 'healthy' as const,
              details: 'Tool is responding correctly',
              timestamp: new Date(),
              metrics: {
                testExecutionTime: Date.now(),
                memoryUsage: process.memoryUsage().heapUsed,
                lastTestResult: testResult.wordCount === 7 ? 'pass' : 'fail'
              }
            };
          } catch (error) {
            return {
              status: 'unhealthy' as const,
              details: `Health check failed: ${error.message}`,
              timestamp: new Date()
            };
          }
        }
      },
      lifecycle: {
        status: 'installed',
        enabled: false,
        logLevel: 'info'
      },
      security: {
        checksum,
        permissions: ['tool:execute'],
        sandboxed: true,
        trustedSource: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private static analyzeSentiment(text: string): string {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'awesome'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing', 'hate', 'dislike', 'awful'];
    
    const words = text.toLowerCase().split(/\s+/);
    const positive = words.filter(word => positiveWords.includes(word)).length;
    const negative = words.filter(word => negativeWords.includes(word)).length;
    
    if (positive > negative) return 'positive';
    if (negative > positive) return 'negative';
    return 'neutral';
  }

  private static extractKeywords(text: string, maxKeywords: number): Array<{word: string, count: number}> {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'is', 'are', 'was', 'were'];
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word));
    
    const frequency: Record<string, number> = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, maxKeywords)
      .map(([word, count]) => ({ word, count }));
  }
}

// Configuration schema for the tool
export const exampleToolConfigSchema = {
  type: 'object',
  properties: {
    maxKeywords: {
      type: 'number',
      description: 'Default maximum number of keywords to extract',
      default: 10,
      minimum: 1,
      maximum: 50
    },
    defaultSentimentAnalysis: {
      type: 'boolean',
      description: 'Whether to include sentiment analysis by default',
      default: true
    },
    cacheResults: {
      type: 'boolean',
      description: 'Whether to cache analysis results',
      default: false
    },
    logLevel: {
      type: 'string',
      description: 'Logging level for this tool',
      enum: ['debug', 'info', 'warn', 'error'],
      default: 'info'
    }
  },
  required: []
};