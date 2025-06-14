import { Injectable, Logger } from '@nestjs/common';
import { simpleGit, SimpleGit, CleanOptions } from 'simple-git';
import * as path from 'path';
import { URL } from 'url';

export interface GitContextInfo {
  isGitRepository: boolean;
  projectName: string;
  agentId: string;
  repositoryUrl?: string;
  currentBranch?: string;
  workingDirectory: string;
  gitRootDirectory?: string;
}

/**
 * Git Context Service for detecting git repository information
 * Used to automatically set agent_id and project for memory attribution
 */
@Injectable()
export class GitContextService {
  private readonly logger = new Logger(GitContextService.name);
  private git: SimpleGit;
  private cachedContext: GitContextInfo | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds cache

  constructor() {
    this.git = simpleGit({
      baseDir: process.cwd(),
      binary: 'git',
      maxConcurrentProcesses: 6,
      trimmed: false,
    });
  }

  /**
   * Get git context information for the current working directory
   */
  async getGitContext(workingDir?: string): Promise<GitContextInfo> {
    const targetDir = workingDir || process.cwd();
    const now = Date.now();

    // Return cached result if still valid and for the same directory
    if (this.cachedContext && 
        this.cachedContext.workingDirectory === targetDir &&
        (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedContext;
    }

    try {
      // Create git instance for the target directory
      const gitInstance = simpleGit({
        baseDir: targetDir,
        binary: 'git',
        maxConcurrentProcesses: 6,
        trimmed: false,
      });

      const context = await this.detectGitContext(gitInstance, targetDir);
      
      // Cache the result
      this.cachedContext = context;
      this.cacheTimestamp = now;
      
      this.logger.debug(`Git context detected: ${JSON.stringify(context)}`);
      return context;

    } catch (error) {
      this.logger.warn(`Failed to detect git context: ${error.message}`);
      return this.createFallbackContext(targetDir);
    }
  }

  /**
   * Clear the cache to force re-detection
   */
  clearCache(): void {
    this.cachedContext = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Extract project name from various sources
   */
  private async detectGitContext(gitInstance: SimpleGit, workingDir: string): Promise<GitContextInfo> {
    const isRepo = await gitInstance.checkIsRepo();
    
    if (!isRepo) {
      return this.createFallbackContext(workingDir);
    }

    const [gitRootDir, remoteUrl, currentBranch] = await Promise.allSettled([
      gitInstance.revparse(['--show-toplevel']),
      this.getRemoteUrl(gitInstance),
      this.getCurrentBranch(gitInstance),
    ]);

    const rootDirectory = gitRootDir.status === 'fulfilled' ? gitRootDir.value.trim() : workingDir;
    const repositoryUrl = remoteUrl.status === 'fulfilled' ? remoteUrl.value : undefined;
    const branch = currentBranch.status === 'fulfilled' ? currentBranch.value : undefined;

    const projectName = this.extractProjectName(repositoryUrl, rootDirectory);
    const agentId = this.generateAgentId(projectName, branch);

    return {
      isGitRepository: true,
      projectName,
      agentId,
      repositoryUrl,
      currentBranch: branch,
      workingDirectory: workingDir,
      gitRootDirectory: rootDirectory,
    };
  }

  /**
   * Get the remote URL of the repository
   */
  private async getRemoteUrl(gitInstance: SimpleGit): Promise<string | undefined> {
    try {
      const remotes = await gitInstance.getRemotes(true);
      
      // Prefer origin, then upstream, then first available
      const preferredRemotes = ['origin', 'upstream'];
      
      for (const remoteName of preferredRemotes) {
        const remote = remotes.find(r => r.name === remoteName);
        if (remote?.refs?.fetch) {
          return remote.refs.fetch;
        }
      }

      // Fall back to first remote with fetch URL
      const firstRemote = remotes.find(r => r.refs?.fetch);
      return firstRemote?.refs?.fetch;

    } catch (error) {
      this.logger.debug(`Failed to get remote URL: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Get the current branch name
   */
  private async getCurrentBranch(gitInstance: SimpleGit): Promise<string | undefined> {
    try {
      const status = await gitInstance.status();
      return status.current || undefined;
    } catch (error) {
      this.logger.debug(`Failed to get current branch: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Extract project name from repository URL or directory
   */
  private extractProjectName(repositoryUrl?: string, rootDirectory?: string): string {
    if (repositoryUrl) {
      const projectFromUrl = this.extractProjectNameFromUrl(repositoryUrl);
      if (projectFromUrl) {
        return projectFromUrl;
      }
    }

    if (rootDirectory) {
      return path.basename(rootDirectory);
    }

    return 'unknown-project';
  }

  /**
   * Extract project name from git remote URL
   */
  private extractProjectNameFromUrl(url: string): string | null {
    try {
      // Handle SSH URLs (git@github.com:user/repo.git)
      const sshMatch = url.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
      if (sshMatch) {
        return sshMatch[3];
      }

      // Handle HTTPS URLs
      if (url.startsWith('http')) {
        const parsedUrl = new URL(url);
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
          const repoName = pathParts[pathParts.length - 1];
          return repoName.replace(/\.git$/, '');
        }
      }

      // Handle other git URL formats
      const genericMatch = url.match(/\/([^\/]+?)(?:\.git)?$/);
      if (genericMatch) {
        return genericMatch[1];
      }

      return null;
    } catch (error) {
      this.logger.debug(`Failed to parse repository URL: ${url}`);
      return null;
    }
  }

  /**
   * Generate agent ID from project name and branch
   */
  private generateAgentId(projectName: string, branch?: string): string {
    const sanitizedProject = projectName.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (branch && branch !== 'main' && branch !== 'master') {
      const sanitizedBranch = branch.toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      return `${sanitizedProject}-${sanitizedBranch}`;
    }

    return sanitizedProject;
  }

  /**
   * Create fallback context when not in a git repository
   */
  private createFallbackContext(workingDir: string): GitContextInfo {
    const directoryName = path.basename(workingDir);
    const projectName = directoryName || 'unknown-project';
    const agentId = this.generateAgentId(projectName);

    return {
      isGitRepository: false,
      projectName,
      agentId,
      workingDirectory: workingDir,
    };
  }

  /**
   * Get minimal context for quick operations
   */
  async getQuickContext(workingDir?: string): Promise<{ projectName: string; agentId: string }> {
    try {
      const context = await this.getGitContext(workingDir);
      return {
        projectName: context.projectName,
        agentId: context.agentId,
      };
    } catch (error) {
      this.logger.warn(`Failed to get quick context: ${error.message}`);
      const targetDir = workingDir || process.cwd();
      const fallback = this.createFallbackContext(targetDir);
      return {
        projectName: fallback.projectName,
        agentId: fallback.agentId,
      };
    }
  }

  /**
   * Validate if a directory is a git repository
   */
  async isGitRepository(workingDir?: string): Promise<boolean> {
    try {
      const targetDir = workingDir || process.cwd();
      const gitInstance = simpleGit({ baseDir: targetDir });
      return await gitInstance.checkIsRepo();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get repository information for display purposes
   */
  async getRepositoryInfo(workingDir?: string): Promise<{
    projectName: string;
    repositoryUrl?: string;
    currentBranch?: string;
    isClean?: boolean;
  }> {
    try {
      const context = await this.getGitContext(workingDir);
      
      let isClean = undefined;
      if (context.isGitRepository) {
        try {
          const gitInstance = simpleGit({ baseDir: context.workingDirectory });
          const status = await gitInstance.status();
          isClean = status.isClean();
        } catch (error) {
          this.logger.debug(`Failed to check repository status: ${error.message}`);
        }
      }

      return {
        projectName: context.projectName,
        repositoryUrl: context.repositoryUrl,
        currentBranch: context.currentBranch,
        isClean,
      };
    } catch (error) {
      this.logger.warn(`Failed to get repository info: ${error.message}`);
      const targetDir = workingDir || process.cwd();
      const fallback = this.createFallbackContext(targetDir);
      return {
        projectName: fallback.projectName,
      };
    }
  }
}