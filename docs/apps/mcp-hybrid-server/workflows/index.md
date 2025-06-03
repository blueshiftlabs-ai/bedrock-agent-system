# Workflows Documentation

## Overview

Workflows in the MCP Hybrid Server use LangGraph to orchestrate complex, multi-step processes. They provide stateful execution, branching logic, and persistent checkpoints.

## Architecture

### Components

1. **[Workflow Graphs](./graphs/)** - Graph definitions and flow logic
2. **[Workflow Nodes](./nodes/)** - Individual processing steps
3. **[Workflow Services](./services/)** - Supporting services
4. **[Workflow States](./states/)** - State management and persistence

## Core Concepts

### Graph-Based Execution
Workflows are defined as directed graphs where:
- **Nodes** represent processing steps
- **Edges** define flow between nodes
- **Conditions** enable branching
- **State** persists between steps

### State Management
All workflows maintain state that:
- Persists to DynamoDB
- Supports checkpointing
- Enables resume after failure
- Tracks execution history

## Available Workflows

### [Code Analysis Workflow](./graphs/code-analysis-workflow.md)
Comprehensive code analysis pipeline:
1. File discovery
2. Parallel analysis
3. Dependency mapping
4. Report generation

### Migration Workflow
Database migration orchestration:
1. Schema analysis
2. Compatibility check
3. Migration script generation
4. Validation

### Documentation Workflow
Automated documentation generation:
1. Code parsing
2. Comment extraction
3. Structure analysis
4. Document generation

## Workflow Definition

```typescript
const workflow = new StateGraph(WorkflowState)
  .addNode('analyze', analyzeNode)
  .addNode('validate', validateNode)
  .addNode('report', reportNode)
  .addEdge('analyze', 'validate')
  .addConditionalEdges('validate', {
    success: 'report',
    failure: END
  })
  .compile();
```

## Execution

### Starting a Workflow
```typescript
const result = await workflowService.execute('code-analysis', {
  input: {
    repository: 'https://github.com/example/repo',
    branch: 'main'
  }
});
```

### Monitoring Progress
```typescript
const status = await workflowService.getStatus(workflowId);
// Returns current node, progress, and state
```

### Resuming Failed Workflows
```typescript
const result = await workflowService.resume(workflowId, {
  fromCheckpoint: true
});
```

## Best Practices

1. **Idempotent Nodes**: Ensure nodes can be safely re-executed
2. **State Validation**: Validate state at each step
3. **Error Handling**: Implement retry logic and fallbacks
4. **Checkpointing**: Save state at critical points
5. **Monitoring**: Track execution metrics

## Configuration

```yaml
workflows:
  persistence:
    enabled: true
    table: 'workflow-states'
  execution:
    timeout: 3600000  # 1 hour
    maxRetries: 3
  checkpointing:
    automatic: true
    interval: 5       # Every 5 nodes
```