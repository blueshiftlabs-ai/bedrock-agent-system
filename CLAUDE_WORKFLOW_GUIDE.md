# Claude Code Workflow Guide for MCP Memory Server Project

## 🚀 Comprehensive Project Management Workflow

This guide documents the optimal workflow for managing projects with Claude Code, utilizing GitHub CLI, TaskMaster AI, and the Memory-local MCP server for enhanced long-term memory and team collaboration.

### 🎯 Core Workflow Steps

#### 1. Project Initialization
```bash
# Initialize TaskMaster AI in project root
mcp__taskmaster-ai__initialize_project --projectRoot="/path/to/project"

# Create GitHub project using CLI
gh project create --owner "organization-name" --title "Project Title"
```

#### 2. Memory Management Best Practices

##### Store Project Context Memory
```typescript
mcp__memory-local__store-memory({
  content: "Project initialization details and context",
  type: "semantic",
  project: "auto-detect-from-git", // Should detect: bedrock-agent-system
  agent_id: "claude-code",
  tags: ["project-init", "context", "workflow"]
})
```

##### Create Memory Connections
```typescript
// Link related memories
mcp__memory-local__add-connection({
  from_memory_id: "mem_project_init",
  to_memory_id: "mem_technical_decision",
  relationship_type: "IMPLEMENTS",
  properties: { confidence: 0.9 }
})

// Create observations from multiple memories
mcp__memory-local__create-observation({
  agent_id: "claude-code",
  observation: "Pattern identified: Successful project setup requires...",
  related_memory_ids: ["mem_1", "mem_2", "mem_3"]
})
```

#### 3. GitHub Project Management

##### Create Milestones
```bash
gh api repos/{owner}/{repo}/milestones \
  --method POST \
  --field title="Milestone Title" \
  --field description="Detailed description" \
  --field due_on="$(date -d '+4 weeks' --iso-8601)T23:59:59Z"
```

##### Create Issues with Labels
```bash
gh issue create \
  --title "Issue Title" \
  --body "**Epic:** Category\n\n**Description:**\nDetailed description\n\n**Acceptance Criteria:**\n- [ ] Task 1\n- [ ] Task 2" \
  --milestone "M1: Milestone Name" \
  --label "epic:category,priority:high"
```

##### Link Issues to Project
```bash
gh project item-add {project-number} --owner {owner} --url {issue-url}
```

#### 4. Task Management Integration

##### Parse PRD to Generate Tasks
```typescript
mcp__taskmaster-ai__parse_prd({
  projectRoot: "/path/to/project",
  input: ".taskmaster/docs/prd.txt",
  numTasks: 15,
  research: true
})
```

##### Track Task Progress
```typescript
mcp__taskmaster-ai__set_task_status({
  id: "task-id",
  status: "in-progress",
  projectRoot: "/path/to/project"
})
```

#### 5. Code-to-Memory Connections

##### Document Code Decisions
```typescript
// When implementing a feature
mcp__memory-local__store-memory({
  content: `Implemented infinite scroll in memory-browser-infinite.tsx
  
  Key decisions:
  - Used intersection observer for performance
  - Added rate limiting (500ms) to prevent double-fetches
  - Server returns has_more flag for pagination
  
  File: apps/mcp-memory-server-dashboard/src/components/memory-browser-infinite.tsx
  Lines: 67-89`,
  type: "procedural",
  content_type: "code",
  tags: ["implementation", "infinite-scroll", "frontend", "performance"]
})
```

##### Link Code to Work Items
```typescript
mcp__memory-local__add-connection({
  from_memory_id: "mem_code_implementation",
  to_memory_id: "mem_github_issue_4",
  relationship_type: "IMPLEMENTS",
  properties: { 
    issue_number: 4,
    commit_sha: "abc123",
    lines_changed: 150
  }
})
```

### 🔗 Memory Connection Strategies

#### 1. Hierarchical Connections
- Project → Epic → Story → Task → Code Implementation
- Each level connected with appropriate relationships

#### 2. Cross-Cutting Concerns
- Connect similar patterns across different features
- Link error solutions to problem memories
- Connect performance improvements across components

#### 3. Team Knowledge Sharing
```typescript
// Store team discoveries
mcp__memory-local__store-memory({
  content: "Discovery: OpenSearch pagination requires...",
  type: "semantic",
  project: "common", // Shared across projects
  tags: ["team-knowledge", "opensearch", "pagination"]
})
```

### 📊 RAG Enhancement Strategies

#### 1. Semantic Code Indexing
- Store code snippets with semantic descriptions
- Link code patterns to concepts
- Create observations about code architecture

#### 2. Work Item Context
- Connect GitHub issues to code changes
- Link PRs to memory observations
- Track decision rationale with work items

#### 3. Cross-Project Learning
```typescript
// Query memories across projects
mcp__memory-local__retrieve-memories({
  query: "infinite scroll implementation",
  project: undefined, // Search all projects
  include_related: true,
  threshold: 0.7
})
```

### 🎯 Workflow Automation Ideas

#### 1. Git Hook Integration
- Auto-create memory on commit
- Link commits to active issues
- Generate observations from commit patterns

#### 2. PR Memory Generation
- Summarize PR changes as memories
- Connect PR to related issues
- Create implementation memories

#### 3. Issue Resolution Tracking
- Document solution approaches
- Link error messages to fixes
- Create troubleshooting knowledge base

### 🚀 Future Enhancements

#### 1. Memory Analytics
- Track most accessed memories
- Identify knowledge gaps
- Suggest missing connections

#### 2. Team Dashboards
- Visualize team knowledge graph
- Show memory contribution stats
- Highlight reusable patterns

#### 3. AI-Powered Insights
- Auto-generate observations
- Suggest memory connections
- Identify similar code patterns

### 📝 Best Practices

1. **Always Create Connections**: Don't just store memories - link them
2. **Use Consistent Tags**: Maintain a tag taxonomy for better retrieval
3. **Document Context**: Include file paths, line numbers, and timestamps
4. **Create Observations**: Synthesize insights from multiple memories
5. **Think Long-term**: Structure memories for future team members

### 🔄 Continuous Improvement

Regular memory maintenance:
- Consolidate similar memories
- Update outdated information
- Strengthen useful connections
- Archive obsolete memories

This workflow enables Claude Code and other AI agents to build comprehensive, long-term memory that improves with each interaction, creating a powerful knowledge management system for software development teams.