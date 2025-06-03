# Code Analyzer Agent

## Overview

The Code Analyzer Agent specializes in analyzing source code to extract insights, identify patterns, and provide recommendations for improvement. It supports multiple programming languages and frameworks.

## Features

### Code Analysis Capabilities
- **Pattern Detection**: Identifies design patterns and anti-patterns
- **Dependency Analysis**: Maps dependencies and import relationships
- **Complexity Metrics**: Calculates cyclomatic complexity and other metrics
- **Security Scanning**: Basic security vulnerability detection
- **Code Quality**: Style violations and best practice adherence

### Supported Languages
- TypeScript/JavaScript
- Python
- Java
- Go
- Rust
- And more...

## API Reference

### Input Schema

```typescript
interface CodeAnalysisInput {
  filePath?: string;      // Single file analysis
  directory?: string;     // Directory analysis
  content?: string;       // Direct code content
  language?: string;      // Programming language
  analysisType: AnalysisType[];
  options?: AnalysisOptions;
}

enum AnalysisType {
  PATTERNS = 'patterns',
  DEPENDENCIES = 'dependencies',
  COMPLEXITY = 'complexity',
  SECURITY = 'security',
  QUALITY = 'quality'
}

interface AnalysisOptions {
  depth?: number;         // Analysis depth (1-5)
  includeTests?: boolean; // Include test files
  threshold?: number;     // Complexity threshold
}
```

### Output Schema

```typescript
interface CodeAnalysisResult {
  summary: AnalysisSummary;
  patterns: Pattern[];
  dependencies: Dependency[];
  metrics: CodeMetrics;
  issues: Issue[];
  recommendations: Recommendation[];
}
```

## Usage Examples

### Basic File Analysis

```typescript
const result = await codeAnalyzerAgent.execute({
  filePath: '/src/services/user.service.ts',
  analysisType: [AnalysisType.PATTERNS, AnalysisType.QUALITY]
});
```

### Directory Analysis with Options

```typescript
const result = await codeAnalyzerAgent.execute({
  directory: '/src',
  analysisType: [AnalysisType.DEPENDENCIES, AnalysisType.COMPLEXITY],
  options: {
    depth: 3,
    includeTests: false,
    threshold: 10
  }
});
```

## Integration with Workflows

The Code Analyzer Agent is commonly used in:
- Code review workflows
- Migration planning
- Technical debt assessment
- Architecture validation

## Performance Considerations

- Large codebases are analyzed incrementally
- Results are cached for repeated analyses
- Parallel processing for multiple files
- Memory-efficient streaming for large files

## Configuration

```yaml
codeAnalyzer:
  maxFileSize: 10MB
  timeout: 60000
  parallelism: 4
  cache:
    enabled: true
    ttl: 3600
```