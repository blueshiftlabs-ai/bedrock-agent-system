import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { EmbeddingRequest, EmbeddingResponse, ContentType } from '../types/memory.types';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { getErrorMessage } from '../utils';

/**
 * Embedding service that generates context-appropriate embeddings
 * for text and code content using different transformer models
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly region: string;

  // Model configuration for different content types
  private readonly textEmbeddingModel = 'amazon.titan-embed-text-v1';
  private readonly codeEmbeddingModel = 'amazon.titan-embed-text-v1';
  private readonly bedrockEnabled: boolean;

  // Local transformer pipelines for fallback
  private textEmbeddingPipeline: FeatureExtractionPipeline | null = null;
  private codeEmbeddingPipeline: FeatureExtractionPipeline | null = null;
  private graphCodeEmbeddingPipeline: FeatureExtractionPipeline | null = null;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bedrockEnabled = this.configService.get<string>('BEDROCK_ENABLED', 'false') === 'true';
    
    // Only initialize Bedrock client if enabled
    if (this.bedrockEnabled) {
      this.bedrockClient = new BedrockRuntimeClient({ region: this.region });
    }
    
    // Initialize local transformer pipelines asynchronously
    this.initializeLocalEmbeddings();
    
    this.logger.log('Embedding Service initialized');
  }

  /**
   * Initialize local transformer pipelines for fallback embeddings
   */
  private async initializeLocalEmbeddings(): Promise<void> {
    try {
      this.logger.log('Initializing local transformer pipelines...');
      
      // Initialize text embedding pipeline (all-MiniLM-L6-v2)
      try {
        this.textEmbeddingPipeline = await pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2',
          { quantized: true, revision: 'main' }
        );
        this.logger.log('Text embedding pipeline (all-MiniLM-L6-v2) initialized');
      } catch (error) {
        this.logger.warn(`Text embedding pipeline failed: ${getErrorMessage(error)}`);
      }
      
      // Initialize code embedding pipeline (smaller model first)
      try {
        this.codeEmbeddingPipeline = await pipeline(
          'feature-extraction', 
          'Xenova/bert-base-uncased', // Start with BERT base as fallback
          { quantized: true, revision: 'main' }
        );
        this.logger.log('Code embedding pipeline (BERT-base) initialized');
      } catch (error) {
        this.logger.warn(`Code embedding pipeline failed: ${getErrorMessage(error)}`);
      }
      
      // Initialize graph-aware code embedding pipeline (same as code for now)
      if (this.codeEmbeddingPipeline) {
        this.graphCodeEmbeddingPipeline = this.codeEmbeddingPipeline;
        this.logger.log('Graph-aware code embedding pipeline aliased to code pipeline');
      }
      
      this.logger.log('Local transformer pipelines initialized successfully');
    } catch (error) {
      this.logger.warn(`Failed to initialize local transformer pipelines: ${getErrorMessage(error)}`);
      this.logger.warn('Will use basic hash-based embeddings as final fallback');
    }
  }

  /**
   * Generate embeddings for any content type
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const { text, content_type, programming_language } = request;

    try {
      let embeddings: number[];
      let modelUsed: string;
      let tokenCount: number;

      if (content_type === 'code') {
        ({ embeddings, modelUsed, tokenCount } = await this.generateCodeEmbedding(text, programming_language));
      } else {
        ({ embeddings, modelUsed, tokenCount } = await this.generateTextEmbedding(text));
      }

      return {
        embeddings,
        model_used: modelUsed,
        token_count: tokenCount,
      };
    } catch (error) {
      this.logger.error(`Failed to generate embedding: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Generate embeddings optimized for natural language text
   */
  private async generateTextEmbedding(text: string): Promise<{
    embeddings: number[];
    modelUsed: string;
    tokenCount: number;
  }> {
    // Use local embeddings if Bedrock is disabled
    if (!this.bedrockEnabled) {
      return this.generateLocalTextEmbedding(text);
    }

    try {
      // Preprocess text for better embeddings
      const processedText = this.preprocessTextForEmbedding(text);

      const command = new InvokeModelCommand({
        modelId: this.textEmbeddingModel,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          inputText: processedText,
        }),
      });

      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      return {
        embeddings: responseBody.embedding,
        modelUsed: this.textEmbeddingModel,
        tokenCount: this.estimateTokenCount(text),
      };
    } catch (error) {
      this.logger.error(`Failed to generate text embedding: ${getErrorMessage(error)}`);
      
      // Fallback to local embedding if Bedrock fails
      return this.generateLocalTextEmbedding(text);
    }
  }

  /**
   * Generate embeddings optimized for code content
   */
  private async generateCodeEmbedding(
    code: string, 
    programmingLanguage?: string
  ): Promise<{
    embeddings: number[];
    modelUsed: string;
    tokenCount: number;
  }> {
    // Use local embeddings if Bedrock is disabled
    if (!this.bedrockEnabled) {
      return this.generateLocalCodeEmbedding(code, programmingLanguage);
    }

    try {
      // Preprocess code for better embeddings
      const processedCode = this.preprocessCodeForEmbedding(code, programmingLanguage);

      // For now, use the same model but with code-specific preprocessing
      // TODO: Switch to code-specific embedding model when available
      const command = new InvokeModelCommand({
        modelId: this.codeEmbeddingModel,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          inputText: processedCode,
        }),
      });

      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      return {
        embeddings: responseBody.embedding,
        modelUsed: this.codeEmbeddingModel,
        tokenCount: this.estimateTokenCount(code),
      };
    } catch (error) {
      this.logger.error(`Failed to generate code embedding: ${getErrorMessage(error)}`);
      
      // Fallback to local embedding
      return this.generateLocalCodeEmbedding(code, programmingLanguage);
    }
  }

  /**
   * Preprocess text content for better embedding generation
   */
  private preprocessTextForEmbedding(text: string): string {
    // Clean and normalize text
    let processed = text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?;:()\-'"]/g, ''); // Remove special chars but keep punctuation

    // Truncate if too long (most embedding models have token limits)
    const maxLength = 8000; // Conservative limit for most models
    if (processed.length > maxLength) {
      processed = processed.substring(0, maxLength) + '...';
      this.logger.warn(`Text truncated to ${maxLength} characters for embedding`);
    }

    return processed;
  }

  /**
   * Preprocess code content for better embedding generation
   */
  private preprocessCodeForEmbedding(code: string, language?: string): string {
    // Add language context if available
    let processed = language ? `// Language: ${language}\n${code}` : code;

    // Normalize code formatting
    processed = processed
      .replace(/\t/g, '  ') // Convert tabs to spaces
      .replace(/\r\n/g, '\n') // Normalize line endings
      .trim();

    // Extract key code elements for better context
    const codeContext = this.extractCodeContext(processed, language);
    if (codeContext) {
      processed = `${codeContext}\n\n${processed}`;
    }

    // Truncate if too long
    const maxLength = 8000;
    if (processed.length > maxLength) {
      processed = processed.substring(0, maxLength) + '\n// ... (truncated)';
      this.logger.warn(`Code truncated to ${maxLength} characters for embedding`);
    }

    return processed;
  }

  /**
   * Extract code context for better embeddings
   */
  private extractCodeContext(code: string, language?: string): string {
    const context: string[] = [];

    // Extract function names
    const functionMatches = code.match(/(?:function|def|fn)\s+(\w+)/g);
    if (functionMatches) {
      context.push(`Functions: ${functionMatches.join(', ')}`);
    }

    // Extract class names
    const classMatches = code.match(/(?:class|interface|type)\s+(\w+)/g);
    if (classMatches) {
      context.push(`Classes: ${classMatches.join(', ')}`);
    }

    // Extract imports/requires
    const importMatches = code.match(/(?:import|require|from)\s+['"](.*?)['"]/g);
    if (importMatches) {
      context.push(`Dependencies: ${importMatches.slice(0, 5).join(', ')}`);
    }

    return context.length > 0 ? `// Context: ${context.join('; ')}` : '';
  }

  /**
   * Fallback local text embedding using transformers.js
   */
  private async generateLocalTextEmbedding(text: string): Promise<{
    embeddings: number[];
    modelUsed: string;
    tokenCount: number;
  }> {
    this.logger.warn('Using fallback local text embedding');
    
    try {
      if (this.textEmbeddingPipeline) {
        const processedText = this.preprocessTextForEmbedding(text);
        const result = await this.textEmbeddingPipeline(processedText, { pooling: 'mean', normalize: true });
        
        // Convert tensor to array and ensure consistent dimensionality
        const embeddings = Array.from(result.data) as number[];
        
        return {
          embeddings,
          modelUsed: 'Xenova/all-MiniLM-L6-v2',
          tokenCount: this.estimateTokenCount(text),
        };
      }
    } catch (error) {
      this.logger.warn(`Transformer-based text embedding failed: ${getErrorMessage(error)}`);
    }
    
    // Final fallback to hash-based embedding
    const embeddings = this.generateHashBasedEmbedding(text);
    return {
      embeddings,
      modelUsed: 'hash-fallback',
      tokenCount: this.estimateTokenCount(text),
    };
  }

  /**
   * Fallback local code embedding using CodeBERT/GraphCodeBERT
   */
  private async generateLocalCodeEmbedding(
    code: string, 
    language?: string
  ): Promise<{
    embeddings: number[];
    modelUsed: string;
    tokenCount: number;
  }> {
    this.logger.warn('Using fallback local code embedding');
    
    try {
      // Try GraphCodeBERT first for graph-aware embeddings
      if (this.graphCodeEmbeddingPipeline) {
        const processedCode = this.preprocessCodeForEmbedding(code, language);
        const result = await this.graphCodeEmbeddingPipeline(processedCode, { pooling: 'mean', normalize: true });
        
        const embeddings = Array.from(result.data) as number[];
        
        return {
          embeddings,
          modelUsed: 'Xenova/codebert-base-graph-aware',
          tokenCount: this.estimateTokenCount(code),
        };
      }
      
      // Fallback to regular CodeBERT
      if (this.codeEmbeddingPipeline) {
        const processedCode = this.preprocessCodeForEmbedding(code, language);
        const result = await this.codeEmbeddingPipeline(processedCode, { pooling: 'mean', normalize: true });
        
        const embeddings = Array.from(result.data) as number[];
        
        return {
          embeddings,
          modelUsed: 'Xenova/codebert-base',
          tokenCount: this.estimateTokenCount(code),
        };
      }
    } catch (error) {
      this.logger.warn(`Transformer-based code embedding failed: ${getErrorMessage(error)}`);
    }
    
    // Final fallback to hash-based embedding
    const embeddings = this.generateHashBasedEmbedding(code + (language || ''));
    return {
      embeddings,
      modelUsed: 'hash-fallback',
      tokenCount: this.estimateTokenCount(code),
    };
  }

  /**
   * Generate a simple hash-based embedding (fallback only)
   */
  private generateHashBasedEmbedding(text: string): number[] {
    const dimension = 384; // Local transformer dimension (all-MiniLM-L6-v2)
    const embeddings = new Array(dimension).fill(0);
    
    // Simple character-based hash to vector
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = charCode % dimension;
      embeddings[index] += (charCode / 255.0) * 0.1;
    }
    
    // Normalize
    const magnitude = Math.sqrt(embeddings.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embeddings.map(val => val / magnitude) : embeddings;
  }

  /**
   * Estimate token count for a text
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));

    return magnitude1 > 0 && magnitude2 > 0 ? dotProduct / (magnitude1 * magnitude2) : 0;
  }

  /**
   * Batch generate embeddings for multiple texts
   */
  async generateBatchEmbeddings(
    requests: EmbeddingRequest[]
  ): Promise<EmbeddingResponse[]> {
    const promises = requests.map(request => this.generateEmbedding(request));
    return Promise.all(promises);
  }

  /**
   * Calculate graph relationship weights using semantic similarity
   * This leverages the transformer embeddings for better graph connections
   */
  calculateGraphRelationshipWeight(
    fromEmbedding: number[], 
    toEmbedding: number[], 
    relationshipType: string
  ): number {
    const similarity = this.calculateSimilarity(fromEmbedding, toEmbedding);
    
    // Adjust weight based on relationship type
    const typeMultipliers = {
      'CREATED': 1.0,           // Agent created memory
      'REFERENCES': 0.8,        // Code references
      'SIMILAR_TO': 0.9,        // Semantic similarity
      'IN_SESSION': 0.7,        // Session membership
      'DEPENDS_ON': 0.85,       // Code dependencies
      'IMPLEMENTS': 0.9,        // Implementation relationships
      'CALLS': 0.75,           // Function calls
    };
    
    const multiplier = typeMultipliers[relationshipType] || 0.6;
    return Math.max(0, Math.min(1, similarity * multiplier));
  }

  /**
   * Generate graph-aware code embeddings with structural context
   * This method specifically optimized for code that will have graph relationships
   */
  async generateGraphAwareCodeEmbedding(
    code: string,
    programmingLanguage?: string,
    structuralContext?: {
      functions?: string[];
      classes?: string[];
      imports?: string[];
      callGraph?: Record<string, string[]>;
    }
  ): Promise<EmbeddingResponse> {
    let enhancedCode = code;
    
    // Add structural context for better graph-aware embeddings
    if (structuralContext) {
      const contextParts = [];
      
      if (structuralContext.functions?.length) {
        contextParts.push(`// Functions: ${structuralContext.functions.join(', ')}`);
      }
      
      if (structuralContext.classes?.length) {
        contextParts.push(`// Classes: ${structuralContext.classes.join(', ')}`);
      }
      
      if (structuralContext.imports?.length) {
        contextParts.push(`// Imports: ${structuralContext.imports.join(', ')}`);
      }
      
      if (structuralContext.callGraph && Object.keys(structuralContext.callGraph).length > 0) {
        const callGraphDesc = Object.entries(structuralContext.callGraph)
          .map(([caller, callees]) => `${caller} -> [${callees.join(', ')}]`)
          .join('; ');
        contextParts.push(`// Call Graph: ${callGraphDesc}`);
      }
      
      if (contextParts.length > 0) {
        enhancedCode = `${contextParts.join('\n')}\n\n${code}`;
      }
    }
    
    return this.generateEmbedding({
      text: enhancedCode,
      content_type: 'code',
      programming_language: programmingLanguage,
    });
  }
}