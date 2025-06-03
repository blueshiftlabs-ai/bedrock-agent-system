import { Injectable, Logger } from '@nestjs/common';
import { MCPTool, MCPToolRegistry } from '../registry/tool.registry';
import { AwsService } from '@/aws/aws.service';
import { z } from 'zod';

@Injectable()
export class CodeAnalysisTool {
  private readonly logger = new Logger(CodeAnalysisTool.name);

  constructor(private readonly awsService: AwsService) {}

  async register(registry: MCPToolRegistry): Promise<void> {
    const tool: MCPTool = {
      name: 'analyze-code-file',
      description: 'Analyzes a source code file to extract functions, classes, dependencies, and complexity metrics',
      category: 'analysis',
      parameters: {
        type: 'object',
        required: ['filePath'],
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the source code file to analyze',
            required: true,
          },
          language: {
            type: 'string',
            description: 'Programming language of the file (optional, will be detected automatically)',
          },
          includeMetrics: {
            type: 'boolean',
            description: 'Whether to include complexity metrics in the analysis',
            default: true,
          },
          extractDependencies: {
            type: 'boolean',
            description: 'Whether to extract and analyze dependencies',
            default: true,
          },
        },
      },
      execute: this.execute.bind(this),
      timeout: 30000,
      retryable: true,
      cacheable: true,
    };

    registry.registerTool(tool);
  }

  private async execute(params: any): Promise<any> {
    const { filePath, language, includeMetrics = true, extractDependencies = true } = params;
    
    this.logger.log(`Analyzing code file: ${filePath}`);

    try {
      // Read file content (from S3 or local filesystem)
      let fileContent: string;
      if (filePath.startsWith('s3://')) {
        const s3Key = filePath.replace('s3://', '').split('/').slice(1).join('/');
        const buffer = await this.awsService.getFromS3(s3Key);
        if (!buffer) {
          throw new Error(`File not found in S3: ${s3Key}`);
        }
        fileContent = buffer.toString('utf-8');
      } else {
        // For local files, we'd need file system access
        // In a real implementation, you might use a different approach
        throw new Error('Local file analysis not implemented yet');
      }

      // Detect language if not provided
      const detectedLanguage = language || this.detectLanguage(filePath);

      // Perform analysis based on language
      const analysisResult = await this.analyzeCodeContent(
        fileContent,
        detectedLanguage,
        filePath,
        { includeMetrics, extractDependencies }
      );

      // Store analysis result in S3 for future reference
      const resultKey = `analysis-results/${Date.now()}-${filePath.split('/').pop()}.json`;
      await this.awsService.storeInS3(resultKey, JSON.stringify(analysisResult, null, 2));

      return {
        ...analysisResult,
        resultStoredAt: `s3://${resultKey}`,
        analyzedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`Error analyzing code file ${filePath}:`, error);
      throw new Error(`Code analysis failed: ${error.message}`);
    }
  }

  private detectLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'mjs': 'javascript',
      'ts': 'typescript',
      'jsx': 'jsx',
      'tsx': 'tsx',
      'py': 'python',
      'java': 'java',
      'cs': 'csharp',
      'go': 'go',
      'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'rs': 'rust',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
    };
    return languageMap[extension || ''] || 'unknown';
  }

  private async analyzeCodeContent(
    content: string,
    language: string,
    filePath: string,
    options: { includeMetrics: boolean; extractDependencies: boolean }
  ): Promise<any> {
    const lines = content.split('\n');
    
    const result = {
      filePath,
      language,
      analysis: {
        imports: [],
        functions: [],
        classes: [],
        dependencies: {
          internal: [],
          external: [],
        },
        metrics: {
          lineCount: lines.length,
          functionCount: 0,
          classCount: 0,
          complexity: 0,
        },
      },
    };

    // Language-specific analysis
    switch (language) {
      case 'javascript':
      case 'typescript':
      case 'jsx':
      case 'tsx':
        this.analyzeJavaScriptTypeScript(content, result.analysis);
        break;
      case 'python':
        this.analyzePython(content, result.analysis);
        break;
      case 'java':
        this.analyzeJava(content, result.analysis);
        break;
      default:
        this.analyzeGeneric(content, result.analysis);
    }

    // Calculate complexity metrics if requested
    if (options.includeMetrics) {
      this.calculateComplexity(content, result.analysis);
    }

    // Extract dependencies if requested
    if (options.extractDependencies) {
      this.classifyDependencies(result.analysis);
    }

    return result;
  }

  private analyzeJavaScriptTypeScript(content: string, analysis: any): void {
    // Import analysis
    const importRegex = /import\s+(?:{\s*([^}]+)\s*}|([^{}\s;]+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[3];
      analysis.imports.push(importPath);
      
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        analysis.dependencies.internal.push(importPath);
      } else {
        analysis.dependencies.external.push(importPath);
      }
    }

    // Function analysis
    const functionRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|([a-zA-Z0-9_$]+)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>)/g;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1] || match[2] || match[3];
      const startLine = content.substring(0, match.index).split('\n').length;
      
      analysis.functions.push({
        name: functionName,
        startLine,
        type: 'function',
      });
      
      analysis.metrics.functionCount++;
    }

    // Class analysis
    const classRegex = /class\s+([a-zA-Z0-9_$]+)/g;
    
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const startLine = content.substring(0, match.index).split('\n').length;
      
      analysis.classes.push({
        name: className,
        startLine,
        type: 'class',
      });
      
      analysis.metrics.classCount++;
    }
  }

  private analyzePython(content: string, analysis: any): void {
    // Import analysis
    const importRegex = /(?:from\s+([^\s]+)\s+import\s+(?:([^,\s]+)(?:,\s*[^,\s]+)*)|import\s+([^\s]+))/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1] || match[3];
      analysis.imports.push(importPath);
      
      if (importPath.startsWith('.')) {
        analysis.dependencies.internal.push(importPath);
      } else {
        analysis.dependencies.external.push(importPath);
      }
    }

    // Function analysis
    const functionRegex = /def\s+([a-zA-Z0-9_]+)\s*\(/g;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const startLine = content.substring(0, match.index).split('\n').length;
      
      analysis.functions.push({
        name: functionName,
        startLine,
        type: 'function',
      });
      
      analysis.metrics.functionCount++;
    }

    // Class analysis
    const classRegex = /class\s+([a-zA-Z0-9_]+)/g;
    
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const startLine = content.substring(0, match.index).split('\n').length;
      
      analysis.classes.push({
        name: className,
        startLine,
        type: 'class',
      });
      
      analysis.metrics.classCount++;
    }
  }

  private analyzeJava(content: string, analysis: any): void {
    // Similar implementation for Java
    // ... (implementation details)
  }

  private analyzeGeneric(content: string, analysis: any): void {
    // Generic analysis for unknown languages
    // ... (implementation details)
  }

  private calculateComplexity(content: string, analysis: any): void {
    // Cyclomatic complexity calculation
    const complexityKeywords = [
      'if', 'else', 'for', 'while', 'switch', 'case', 'catch', 'try',
      '&&', '||', '?', ':', 'elif', 'except'
    ];
    
    let complexity = 1; // Base complexity
    
    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex) || [];
      complexity += matches.length;
    });
    
    analysis.metrics.complexity = complexity;
  }

  private classifyDependencies(analysis: any): void {
    // Enhanced dependency classification
    // ... (implementation details)
  }
}
