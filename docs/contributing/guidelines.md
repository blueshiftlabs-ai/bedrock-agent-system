# Contributing Guidelines

## Welcome!

We're excited that you're interested in contributing to the Bedrock Agent System. This document provides guidelines to ensure smooth collaboration and maintain code quality.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## Getting Started

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/bedrock-agent-system.git
cd bedrock-agent-system

# Add upstream remote
git remote add upstream https://github.com/original-org/bedrock-agent-system.git
```

### 2. Setup Development Environment

```bash
# Install dependencies
pnpm install

# Setup local development
pnpm --filter @apps/mcp-hybrid-server run setup-local-dev

# Run tests to ensure everything works
pnpm test
```

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

## Development Workflow

### 1. Make Changes

- Write clean, readable code
- Follow existing patterns and conventions
- Add tests for new functionality
- Update documentation as needed

### 2. Code Style

We use ESLint and Prettier for code formatting:

```bash
# Format code
pnpm format

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix
```

### 3. Testing

All changes must include appropriate tests:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test path/to/test.spec.ts
```

### 4. Commit Messages

We follow Conventional Commits specification:

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Build process or auxiliary tool changes

Examples:
```bash
git commit -m "feat(agents): add retry logic to code analyzer"
git commit -m "fix(workflows): resolve memory leak in state management"
git commit -m "docs(api): update endpoint documentation"
```

## Pull Request Process

### 1. Update Your Branch

```bash
git fetch upstream
git rebase upstream/main
```

### 2. Push Changes

```bash
git push origin feature/your-feature-name
```

### 3. Create Pull Request

- Use a clear, descriptive title
- Reference any related issues
- Provide a detailed description of changes
- Include screenshots for UI changes
- Ensure all checks pass

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

## Development Guidelines

### TypeScript Best Practices

1. **Use strict typing**
```typescript
// Good
function processData(data: UserData): ProcessedResult {
  // ...
}

// Avoid
function processData(data: any): any {
  // ...
}
```

2. **Prefer interfaces over types for objects**
```typescript
// Good
interface User {
  id: string;
  name: string;
}

// Use type for unions/intersections
type Status = 'active' | 'inactive';
```

3. **Use async/await over promises**
```typescript
// Good
async function fetchData(): Promise<Data> {
  const result = await api.get('/data');
  return result.data;
}

// Avoid
function fetchData(): Promise<Data> {
  return api.get('/data').then(result => result.data);
}
```

### NestJS Patterns

1. **Use dependency injection**
```typescript
@Injectable()
export class UserService {
  constructor(
    private readonly repository: UserRepository,
    private readonly logger: Logger,
  ) {}
}
```

2. **Implement proper error handling**
```typescript
@Injectable()
export class UserService {
  async getUser(id: string): Promise<User> {
    try {
      const user = await this.repository.findById(id);
      if (!user) {
        throw new NotFoundException(`User ${id} not found`);
      }
      return user;
    } catch (error) {
      this.logger.error(`Failed to get user ${id}`, error);
      throw error;
    }
  }
}
```

### Testing Standards

1. **Write descriptive test names**
```typescript
describe('UserService', () => {
  describe('getUser', () => {
    it('should return user when found', async () => {
      // test implementation
    });
    
    it('should throw NotFoundException when user does not exist', async () => {
      // test implementation
    });
  });
});
```

2. **Use test data builders**
```typescript
class UserBuilder {
  private user: Partial<User> = {};
  
  withId(id: string): this {
    this.user.id = id;
    return this;
  }
  
  build(): User {
    return {
      id: this.user.id || 'default-id',
      name: this.user.name || 'Default Name',
      // ... other defaults
    } as User;
  }
}
```

## Documentation

### Code Documentation

```typescript
/**
 * Analyzes source code and returns quality metrics.
 * 
 * @param filePath - Path to the file to analyze
 * @param options - Analysis options
 * @returns Analysis results including metrics and recommendations
 * @throws {FileNotFoundError} If the file doesn't exist
 * @throws {UnsupportedLanguageError} If the language isn't supported
 * 
 * @example
 * ```typescript
 * const results = await analyzer.analyze('/src/app.ts', {
 *   includeMetrics: true,
 *   depth: 3
 * });
 * ```
 */
async analyze(filePath: string, options?: AnalysisOptions): Promise<AnalysisResult> {
  // implementation
}
```

### API Documentation

Update OpenAPI/Swagger documentation for API changes:

```typescript
@ApiOperation({ summary: 'Get user by ID' })
@ApiParam({ name: 'id', description: 'User ID' })
@ApiResponse({ status: 200, description: 'User found', type: UserDto })
@ApiResponse({ status: 404, description: 'User not found' })
@Get(':id')
async getUser(@Param('id') id: string): Promise<UserDto> {
  // implementation
}
```

## Review Process

### What We Look For

1. **Code Quality**
   - Clean, readable code
   - Proper error handling
   - No code duplication
   - Performance considerations

2. **Testing**
   - Adequate test coverage
   - Edge cases handled
   - Integration tests for complex features

3. **Documentation**
   - Code comments where necessary
   - Updated README files
   - API documentation

4. **Security**
   - No hardcoded secrets
   - Input validation
   - Proper authentication/authorization

### Review Timeline

- Initial review: Within 2-3 business days
- Follow-up reviews: Within 1-2 business days
- Small fixes: Same day when possible

## Release Process

1. **Version Bumping**
   - We use semantic versioning
   - Version bumps are handled by maintainers

2. **Changelog**
   - All notable changes are documented
   - Based on commit messages

3. **Release Schedule**
   - Major releases: Quarterly
   - Minor releases: Monthly
   - Patches: As needed

## Getting Help

- **Discord**: [Join our community](https://discord.gg/example)
- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and ideas
- **Email**: maintainers@example.com

## Recognition

We value all contributions:
- Code contributions
- Documentation improvements
- Bug reports
- Feature suggestions
- Community support

Contributors are recognized in:
- Release notes
- Contributors file
- Annual contributor spotlight

Thank you for contributing to the Bedrock Agent System!