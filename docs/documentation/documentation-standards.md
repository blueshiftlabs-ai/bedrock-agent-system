# Documentation Standards and Guidelines

## Table of Contents

1. [Introduction](#introduction)
2. [Documentation Structure](#documentation-structure)
   - [Repository Root Documentation](#repository-root-documentation)
   - [Docs Directory](#docs-directory)
   - [Module-Specific Documentation](#module-specific-documentation)
   - [Package and App Documentation](#package-and-app-documentation)
3. [Document Format Standards](#document-format-standards)
   - [Markdown Requirements](#markdown-requirements)
   - [Table of Contents Requirements](#table-of-contents-requirements)
   - [Code Blocks and Examples](#code-blocks-and-examples)
   - [Images and Diagrams](#images-and-diagrams)
4. [Content Guidelines](#content-guidelines)
   - [Document Types](#document-types)
   - [Writing Style](#writing-style)
   - [Linking Related Content](#linking-related-content)
   - [Versioning Documentation](#versioning-documentation)
5. [Documentation Maintenance](#documentation-maintenance)
   - [Review Process](#review-process)
   - [Outdated Documentation](#outdated-documentation)
   - [Changelog Integration](#changelog-integration)
6. [Markdown Linting and Validation](#markdown-linting-and-validation)
   - [Common Lint Issues](#common-lint-issues)
   - [Fixing Lint Errors](#fixing-lint-errors)
   - [Automated Validation](#automated-validation)

## Introduction

This guide establishes standards and best practices for creating and maintaining documentation in the Radian Virtual Assistant project. Following these guidelines ensures that documentation is consistent, discoverable, and useful to all team members.

## Documentation Structure

Documentation should follow a clear hierarchical structure to help users find information quickly:

### Repository Root Documentation

- **README.md**: The main entry point providing:
  - Project overview and purpose
  - Key features
  - Installation instructions
  - Quick start guide
  - Links to other documentation
  - Development requirements
  - License information

- **CONTRIBUTING.md**: Guidelines for contributors
- **LICENSE.md**: License information
- **CHANGELOG.md**: Project-wide changelog

### Docs Directory

The `docs/` directory is the central location for all detailed documentation:

```
docs/
├── README.md                    # Overview of available documentation
├── getting-started.md           # Getting started guide
├── architecture/                # Architecture documentation
│   ├── overview.md              # System architecture overview
│   ├── service-interactions.md  # Service interaction patterns
│   └── data-flows.md            # Data flow diagrams
├── infrastructure/              # Infrastructure documentation
│   ├── aws-setup.md             # AWS setup guide
│   ├── deployment.md            # Deployment guide
│   └── ci-cd.md                 # CI/CD pipeline documentation
├── development/                 # Development guidelines
│   ├── code-style.md            # Code style guide
│   ├── testing.md               # Testing guidelines
│   └── debugging.md             # Debugging guide
├── security/                    # Security documentation
│   ├── authentication.md        # Authentication system
│   ├── authorization.md         # Authorization system
│   └── credential-management/   # Credential management
│       ├── overview.md          # Overview
│       ├── rotation.md          # Credential rotation
│       └── storage.md           # Credential storage
├── api/                         # API documentation
│   ├── rest-api.md              # REST API documentation
│   └── graphql.md               # GraphQL schema documentation
└── ui/                          # UI documentation
    ├── components.md            # UI components
    └── design-system.md         # Design system
```

### Module-Specific Documentation

- Each major module under `infrastructure/modules` should have its own README.md
- Documentation should include usage examples, parameters, and configurations
- Include diagrams when necessary to explain complex interactions

### Package and App Documentation

- Each package and app in the monorepo should have its own README.md
- Document the purpose, configuration, and usage of each package

## Document Format Standards

### Markdown Requirements

- Use Markdown for all documentation files
- Follow a consistent heading structure (H1 for title, H2 for major sections, etc.)
- Use proper formatting for:
  - **Bold** for emphasis
  - *Italic* for secondary emphasis
  - `Code` for code references, commands, file paths, and parameter names
  - Horizontal rules (---) to separate major sections
  - Proper line breaks between sections

### Table of Contents Requirements

- **All** documentation files over 100 lines MUST include a Table of Contents
- The TOC should be placed immediately after the document title
- Use anchor links to allow quick navigation
- Example format:

```markdown
# Document Title

## Table of Contents

1. [Section One](#section-one)
2. [Section Two](#section-two)
   - [Subsection A](#subsection-a)
   - [Subsection B](#subsection-b)
3. [Section Three](#section-three)
```

### Code Blocks and Examples

- Use fenced code blocks with proper language specification
- Include comments in code examples to explain complex logic
- For terminal commands, indicate the expected output when helpful
- Example:

````markdown
```typescript
// Initialize the authentication client
const authClient = new AuthClient({
  tenantId: process.env.TENANT_ID, // Microsoft Entra ID tenant
  clientId: process.env.CLIENT_ID, // Application ID
  secret: process.env.CLIENT_SECRET // Client secret
});
```
````

### Images and Diagrams

- Store images in a dedicated `docs/assets` directory
- Use relative paths to reference images
- Include alt text for all images
- Use SVG format for diagrams when possible
- Include source files for diagrams when applicable (e.g., draw.io XML)

## Content Guidelines

### Document Types

Different types of documentation serve different purposes:

1. **Overview Documents**: High-level explanations of system components
2. **Tutorials**: Step-by-step guides for specific tasks
3. **How-To Guides**: Problem-oriented guidance for specific scenarios
4. **Reference Documents**: Detailed technical specifications
5. **Explanatory Guides**: Concept-oriented material explaining the "why"

### Writing Style

- Use clear, concise language
- Write in present tense
- Use active voice
- Define acronyms and technical terms on first use
- Use numbered lists for sequential steps
- Use bullet points for non-sequential items
- Include examples to illustrate concepts

### Linking Related Content

- Cross-reference related documentation using relative links
- Avoid hardcoding absolute URLs that may change
- Link to source files when referencing code
- Example:

```markdown
For more information about credential rotation, see [Credential Rotation Guide](../security/credential-management/rotation.md).
```

### Versioning Documentation

- Indicate when documentation applies to specific versions
- Update documentation when APIs change
- Consider using tags or branches for major version documentation

## Documentation Maintenance

### Review Process

- Documentation should be reviewed as part of the pull request process
- Technical accuracy is as important as code quality
- Check for broken links, outdated information, and formatting issues

### Outdated Documentation

- Mark outdated sections clearly
- Remove documentation that is no longer relevant
- Create issues for documentation that needs updating

### Changelog Integration

- Update relevant documentation when features change
- Reference documentation updates in the changelog
- Consider automated tools to verify documentation links

## Markdown Linting and Validation

Markdown linting is essential to maintain consistent formatting and ensure documentation quality. Our project uses a markdown linter to catch common issues before they make it to production.

### Common Lint Issues

- **Missing Table of Contents**: All files over 100 lines must include a TOC
- **Missing Language Specification**: Always specify the language in code blocks
```markdown
# Good
```typescript
const example = true;
```

# Bad
```
const example = true;
```
```

- **Invalid Link Fragments**: Ensure anchor links match heading IDs exactly
- **Inconsistent Heading Structure**: Follow the hierarchical heading structure (H1 → H2 → H3)
- **Trailing Spaces**: Avoid trailing spaces at the end of lines
- **Missing Blank Lines**: Include blank lines before and after lists and code blocks

### Fixing Lint Errors

1. **Code Block Language**: Always specify a language for fenced code blocks
   ```markdown
   ```typescript
   const example = true;
   ```
   ```

2. **Table of Contents**: Use consistent format and ensure links match heading IDs
   ```markdown
   ## Table of Contents
   - [Section One](#section-one)
   - [Section Two](#section-two)
   ```

3. **Blank Lines**: Ensure proper spacing around lists and code blocks
   ```markdown
   Paragraph text.

   - List item 1
   - List item 2

   Next paragraph.
   ```

4. **Images**: Always include alt text and use the proper format
   ```markdown
   ![Alt text description](../assets/image.png "Optional title")
   ```

### Automated Validation

- Run markdown linting locally before committing changes
- CI/CD pipelines will check markdown for lint errors
- Use the project's markdown validation tool to check your files:
  ```bash
  pnpm lint:markdown
  ```

---

By following these guidelines, we ensure that documentation remains a valuable resource for all team members and contributes to the overall quality of the Radian Virtual Assistant project.