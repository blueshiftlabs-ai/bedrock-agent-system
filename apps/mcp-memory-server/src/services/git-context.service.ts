import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export interface GitContext {
  isGitRepository: boolean;
  projectName: string;
  repositoryUrl?: string;
  currentBranch?: string;
  agentId: string;
  isClean?: boolean;
  workingDirectory: string;
}

/**
 * Service to provide project and agent information for memory attribution.
 * Priority: ENV vars > explicit params > git context > defaults
 * 
 * NOTE: Git context is only useful in development - production should use ENV vars
 */
@Injectable()
export class GitContextService {
  private readonly logger = new Logger(GitContextService.name);
  private cachedContext: GitContext | null = null;
  private cacheTime: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * Get project context with proper priority order:
   * 1. Environment variables (production/docker)
   * 2. Explicit parameters (user-provided)
   * 3. Git context (development fallback)
   * 4. Defaults
   */
  async getGitContext(workingDir?: string, explicitProject?: string, explicitAgent?: string): Promise<GitContext> {
    const now = Date.now();
    
    // Return cached result if still valid (but allow ENV var overrides)
    if (this.cachedContext && (now - this.cacheTime) < this.CACHE_DURATION) {
      return this.applyEnvironmentOverrides(this.cachedContext, explicitProject, explicitAgent);
    }

    const context = await this.detectGitContext(workingDir);
    const finalContext = this.applyEnvironmentOverrides(context, explicitProject, explicitAgent);
    
    this.cachedContext = finalContext;
    this.cacheTime = now;
    
    return finalContext;
  }

  /**
   * Apply environment variables and explicit parameters with proper priority
   */
  private applyEnvironmentOverrides(context: GitContext, explicitProject?: string, explicitAgent?: string): GitContext {
    // Priority: ENV vars > explicit params > context values > defaults
    const projectName = process.env.MEMORY_PROJECT_NAME || explicitProject || context.projectName || 'common';
    const agentId = process.env.MEMORY_AGENT_ID || explicitAgent || context.agentId || 'claude-code';

    this.logger.debug(`Final context: project=${projectName}, agent=${agentId} (ENV=${!!process.env.MEMORY_PROJECT_NAME}, explicit=${!!explicitProject}, git=${context.projectName})`);

    return {
      ...context,
      projectName,
      agentId
    };
  }

  /**
   * Force refresh of git context cache
   */
  async refreshContext(workingDir?: string): Promise<GitContext> {
    this.cachedContext = null;
    return this.getGitContext(workingDir);
  }

  /**
   * Get project name suitable for memory storage
   */
  async getProjectName(workingDir?: string): Promise<string> {
    const context = await this.getGitContext(workingDir);
    return context.projectName;
  }

  /**
   * Get agent ID suitable for memory storage
   */
  async getAgentId(workingDir?: string): Promise<string> {
    const context = await this.getGitContext(workingDir);
    return context.agentId;
  }

  private async detectGitContext(workingDir?: string): Promise<GitContext> {
    const currentDir = workingDir || process.cwd();
    
    const defaultContext: GitContext = {
      isGitRepository: false,
      projectName: 'common',
      agentId: 'claude-code',
      workingDirectory: currentDir,
    };

    try {
      // Check if we're in a git repository
      const gitDir = this.findGitDirectory(currentDir);
      if (!gitDir) {
        this.logger.debug('Not in a git repository, using defaults');
        return defaultContext;
      }

      // Set working directory for git commands
      const execOptions = { cwd: gitDir };

      // Get repository information
      const [remoteUrl, currentBranch, status] = await Promise.allSettled([
        this.getRemoteUrl(execOptions),
        this.getCurrentBranch(execOptions),
        this.getWorkingTreeStatus(execOptions),
      ]);

      // Extract project name from remote URL
      const url = remoteUrl.status === 'fulfilled' ? remoteUrl.value : undefined;
      const projectName = this.extractProjectName(url);
      
      // Generate agent ID
      const branch = currentBranch.status === 'fulfilled' ? currentBranch.value : undefined;
      const agentId = this.generateAgentId(projectName, branch);
      
      // Determine if working tree is clean
      const isClean = status.status === 'fulfilled' ? status.value : undefined;

      const context: GitContext = {
        isGitRepository: true,
        projectName,
        repositoryUrl: url,
        currentBranch: branch,
        agentId,
        isClean,
        workingDirectory: gitDir,
      };

      this.logger.debug(`Git context detected: ${JSON.stringify(context)}`);
      return context;

    } catch (error) {
      this.logger.warn(`Failed to detect git context: ${error.message}`);
      return defaultContext;
    }
  }

  private findGitDirectory(startDir: string): string | null {
    let currentDir = startDir;
    
    while (currentDir !== '/') {
      const gitPath = join(currentDir, '.git');
      if (existsSync(gitPath)) {
        return currentDir;
      }
      currentDir = join(currentDir, '..');
    }
    
    return null;
  }

  private async getRemoteUrl(execOptions: any): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync('git remote get-url origin', { ...execOptions, encoding: 'utf8' });
      return stdout.toString().trim();
    } catch (error) {
      // Try alternative approach
      try {
        const { stdout } = await execAsync('git config --get remote.origin.url', { ...execOptions, encoding: 'utf8' });
        return stdout.toString().trim();
      } catch (fallbackError) {
        this.logger.debug('No remote origin found');
        return undefined;
      }
    }
  }

  private async getCurrentBranch(execOptions: any): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync('git branch --show-current', { ...execOptions, encoding: 'utf8' });
      return stdout.toString().trim();
    } catch (error) {
      // Fallback for older git versions
      try {
        const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { ...execOptions, encoding: 'utf8' });
        return stdout.toString().trim();
      } catch (fallbackError) {
        this.logger.debug('Could not determine current branch');
        return undefined;
      }
    }
  }

  private async getWorkingTreeStatus(execOptions: any): Promise<boolean | undefined> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { ...execOptions, encoding: 'utf8' });
      return stdout.toString().trim().length === 0;
    } catch (error) {
      this.logger.debug('Could not determine working tree status');
      return undefined;
    }
  }

  private extractProjectName(remoteUrl?: string): string {
    if (!remoteUrl) {
      return 'common';
    }

    try {
      // Handle different URL formats
      let projectName: string;

      if (remoteUrl.startsWith('git@')) {
        // SSH format: git@github.com:user/repo.git
        const match = remoteUrl.match(/git@[^:]+:([^/]+)\/(.+?)(?:\.git)?$/);
        projectName = match ? match[2] : 'common';
      } else if (remoteUrl.startsWith('http')) {
        // HTTPS format: https://github.com/user/repo.git
        const url = new URL(remoteUrl);
        const pathParts = url.pathname.split('/').filter(Boolean);
        projectName = pathParts.length >= 2 ? pathParts[1].replace(/\.git$/, '') : 'common';
      } else {
        // Local or other format
        const parts = remoteUrl.split('/');
        projectName = parts[parts.length - 1].replace(/\.git$/, '') || 'common';
      }

      // Sanitize project name
      return projectName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    } catch (error) {
      this.logger.debug(`Failed to parse remote URL: ${remoteUrl}`);
      return 'common';
    }
  }

  private generateAgentId(projectName: string, branch?: string): string {
    let agentId = 'claude-code';

    if (projectName && projectName !== 'common') {
      agentId = projectName;

      // Add branch suffix for non-main branches
      if (branch && !['main', 'master', 'develop'].includes(branch)) {
        // Limit branch suffix to avoid overly long agent IDs
        const sanitizedBranch = branch.replace(/[^a-z0-9-]/gi, '-').slice(0, 20);
        agentId = `${projectName}-${sanitizedBranch}`;
      }
    }

    return agentId;
  }
}