# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commit Management Strategy

### Automatic Commit Guidelines

Claude Code should automatically create commits throughout development sessions using conventional commit format to maintain clear project history:

**Conventional Commit Format:**

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**

- `feat`: New features or major functionality additions
- `fix`: Bug fixes and issue resolutions
- `refactor`: Code restructuring without changing external behavior
- `docs`: Documentation updates
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates, configuration changes
- `perf`: Performance improvements
- `build`: Build system or external dependency changes

**When to Commit:**

1. **Feature Completion**: After implementing a complete feature or significant functionality
2. **Logical Milestones**: When reaching a stable, working state of a component
3. **Bug Fixes**: After resolving issues or compilation errors
4. **Refactoring**: After completing code reorganization or cleanup
5. **Configuration Changes**: After updating project configuration or dependencies
6. **Before Major Changes**: Before starting risky refactoring or architectural changes

**When NOT to Commit:**

- After every single file change or minor edit
- In the middle of implementing a feature
- When code is in a broken or incomplete state
- For experimental changes that may be reverted

**Examples:**

```bash
feat(mcp-hybrid): implement WebSocket gateway for real-time dashboard communication
fix(memory-server): correct health endpoint path for server discovery
refactor(tool-registry): improve error handling with centralized error utils
docs(architecture): add comprehensive MCP hybrid server overhaul plan
chore(deps): update NestJS and related dependencies
```

**Commit Frequency**: Aim for 3-7 commits per development session, ensuring each commit represents a logical unit of work that could be reverted independently if needed.

## GitHub Project Management

**Repository**: `blueshiftlabs-ai/bedrock-agent-system`
**Project**: "MCP Memory Server Production" (Organization-level project #1)
**Owner**: `blueshiftlabs-ai`

### Key gh CLI Commands:
```bash
# List organization projects
gh project list --owner blueshiftlabs-ai

# List repository issues
gh issue list --repo blueshiftlabs-ai/bedrock-agent-system

# Create new issue
gh issue create --repo blueshiftlabs-ai/bedrock-agent-system --title "Issue Title" --body "Description" --label "bug"

# Add issue to organization project
gh project item-add 1 --owner blueshiftlabs-ai --url https://github.com/blueshiftlabs-ai/bedrock-agent-system/issues/[NUMBER]
```

**Important**: The project is at the ORGANIZATION level, not repository level. Issues must be explicitly added to the org-level project using the commands above.

**GitHub Project Manager MCP Tool**: Currently broken with systematic "invalid_type" errors. Use gh CLI instead.

## Memories

- do not use substring, like m.content.substring(0, 50), use slice instead
- Always test scripts you create. Never tell the human things are completed until you have run the code and verified with absolute certainty the task has been completed. You can do with regression testing, but should also always create unit tests and e2e tests for created code.
- GitHub Project: Use "blueshiftlabs-ai/bedrock-agent-system" repo with org-level project "MCP Memory Server Production" (project #1). Always use `gh project item-add 1 --owner blueshiftlabs-ai --url [ISSUE_URL]` to add issues to the project. The GitHub project manager MCP tool is broken - use gh CLI instead.