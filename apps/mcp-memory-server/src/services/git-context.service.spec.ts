import { Test, TestingModule } from '@nestjs/testing';
import { GitContextService } from './git-context.service';
import { exec } from 'child_process';
import { existsSync } from 'fs';

jest.mock('child_process');
jest.mock('fs');

describe('GitContextService', () => {
  let service: GitContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GitContextService],
    }).compile();

    service = module.get<GitContextService>(GitContextService);
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getGitContext', () => {
    it('should detect git repository and extract project information', async () => {
      // Mock git directory detection
      (existsSync as jest.Mock).mockReturnValue(true);
      
      // Mock git commands
      const mockExec = exec as unknown as jest.Mock;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd === 'git remote get-url origin') {
          callback(null, { stdout: 'https://github.com/blueshiftlabs-ai/bedrock-agent-system.git\n' });
        } else if (cmd === 'git branch --show-current') {
          callback(null, { stdout: 'main\n' });
        } else if (cmd === 'git status --porcelain') {
          callback(null, { stdout: '' }); // Clean working tree
        }
      });

      const context = await service.getGitContext();

      expect(context).toEqual({
        isGitRepository: true,
        projectName: 'bedrock-agent-system',
        repositoryUrl: 'https://github.com/blueshiftlabs-ai/bedrock-agent-system.git',
        currentBranch: 'main',
        agentId: 'bedrock-agent-system',
        isClean: true,
        workingDirectory: expect.any(String),
      });
    });

    it('should prioritize environment variables over git context', async () => {
      process.env.MEMORY_PROJECT_NAME = 'env-project';
      process.env.MEMORY_AGENT_ID = 'env-agent';
      
      (existsSync as jest.Mock).mockReturnValue(true);
      
      const mockExec = exec as unknown as jest.Mock;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd === 'git remote get-url origin') {
          callback(null, { stdout: 'https://github.com/blueshiftlabs-ai/bedrock-agent-system.git\n' });
        } else if (cmd === 'git branch --show-current') {
          callback(null, { stdout: 'main\n' });
        } else if (cmd === 'git status --porcelain') {
          callback(null, { stdout: '' });
        }
      });

      const context = await service.getGitContext();
      
      expect(context.projectName).toBe('env-project');
      expect(context.agentId).toBe('env-agent');
      
      // Clean up
      delete process.env.MEMORY_PROJECT_NAME;
      delete process.env.MEMORY_AGENT_ID;
    });

    it('should prioritize explicit parameters over git context', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      
      const mockExec = exec as unknown as jest.Mock;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd === 'git remote get-url origin') {
          callback(null, { stdout: 'https://github.com/blueshiftlabs-ai/bedrock-agent-system.git\n' });
        } else if (cmd === 'git branch --show-current') {
          callback(null, { stdout: 'main\n' });
        } else if (cmd === 'git status --porcelain') {
          callback(null, { stdout: '' });
        }
      });

      const context = await service.getGitContext(undefined, 'explicit-project', 'explicit-agent');
      
      expect(context.projectName).toBe('explicit-project');
      expect(context.agentId).toBe('explicit-agent');
    });

    it('should return default context when not in git repository', async () => {
      // Mock no git directory
      (existsSync as jest.Mock).mockReturnValue(false);

      const context = await service.getGitContext();

      expect(context).toEqual({
        isGitRepository: false,
        projectName: 'common',
        agentId: 'claude-code',
        workingDirectory: expect.any(String),
      });
    });

    it('should handle SSH format git URLs', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      
      const mockExec = exec as unknown as jest.Mock;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd === 'git remote get-url origin') {
          callback(null, { stdout: 'git@github.com:blueshiftlabs-ai/bedrock-agent-system.git\n' });
        } else if (cmd === 'git branch --show-current') {
          callback(null, { stdout: 'main\n' });
        } else if (cmd === 'git status --porcelain') {
          callback(null, { stdout: '' });
        }
      });

      const context = await service.getGitContext();

      expect(context.projectName).toBe('bedrock-agent-system');
      expect(context.repositoryUrl).toBe('git@github.com:blueshiftlabs-ai/bedrock-agent-system.git');
    });

    it('should append branch suffix for non-main branches', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      
      const mockExec = exec as unknown as jest.Mock;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd === 'git remote get-url origin') {
          callback(null, { stdout: 'https://github.com/blueshiftlabs-ai/bedrock-agent-system.git\n' });
        } else if (cmd === 'git branch --show-current') {
          callback(null, { stdout: 'feature/new-feature\n' });
        } else if (cmd === 'git status --porcelain') {
          callback(null, { stdout: 'M some-file.ts\n' }); // Dirty working tree
        }
      });

      const context = await service.getGitContext();

      expect(context.currentBranch).toBe('feature/new-feature');
      expect(context.agentId).toBe('bedrock-agent-system-feature-new-feature');
      expect(context.isClean).toBe(false);
    });

    it('should use cached context within cache duration', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      
      const mockExec = exec as unknown as jest.Mock;
      let callCount = 0;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callCount++;
        if (cmd === 'git remote get-url origin') {
          callback(null, { stdout: 'https://github.com/blueshiftlabs-ai/bedrock-agent-system.git\n' });
        } else if (cmd === 'git branch --show-current') {
          callback(null, { stdout: 'main\n' });
        } else if (cmd === 'git status --porcelain') {
          callback(null, { stdout: '' });
        }
      });

      // First call
      const context1 = await service.getGitContext();
      const firstCallCount = callCount;

      // Second call (should use cache)
      const context2 = await service.getGitContext();
      
      expect(context1).toEqual(context2);
      expect(callCount).toBe(firstCallCount); // No additional git calls
    });

    it('should handle git command errors gracefully', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      
      const mockExec = exec as unknown as jest.Mock;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(new Error('Git command failed'));
      });

      const context = await service.getGitContext();

      // Should return context with git repository true but git commands failed
      expect(context).toEqual({
        isGitRepository: true,
        projectName: 'common',
        agentId: 'claude-code',
        repositoryUrl: undefined,
        currentBranch: undefined,
        isClean: undefined,
        workingDirectory: expect.any(String),
      });
    });
  });

  describe('refreshContext', () => {
    it('should force refresh and bypass cache', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      
      let branchCounter = 0;
      const mockExec = exec as unknown as jest.Mock;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd === 'git remote get-url origin') {
          callback(null, { stdout: 'https://github.com/blueshiftlabs-ai/bedrock-agent-system.git\n' });
        } else if (cmd === 'git branch --show-current') {
          branchCounter++;
          callback(null, { stdout: `branch-${branchCounter}\n` }); // Different branch each call
        } else if (cmd === 'git status --porcelain') {
          callback(null, { stdout: '' });
        }
      });

      // First call
      const context1 = await service.getGitContext();
      expect(context1.currentBranch).toBe('branch-1'); // First branch call

      // Force refresh
      const context2 = await service.refreshContext();
      expect(context2.currentBranch).toBe('branch-2'); // Second branch call
      expect(branchCounter).toBe(2);
    });
  });

  describe('getProjectName', () => {
    it('should return project name from git context', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      
      const mockExec = exec as unknown as jest.Mock;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd === 'git remote get-url origin') {
          callback(null, { stdout: 'https://github.com/blueshiftlabs-ai/bedrock-agent-system.git\n' });
        } else {
          callback(null, { stdout: 'main\n' });
        }
      });

      const projectName = await service.getProjectName();
      expect(projectName).toBe('bedrock-agent-system');
    });
  });

  describe('getAgentId', () => {
    it('should return agent ID from git context', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      
      const mockExec = exec as unknown as jest.Mock;
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        if (cmd === 'git remote get-url origin') {
          callback(null, { stdout: 'https://github.com/blueshiftlabs-ai/bedrock-agent-system.git\n' });
        } else if (cmd === 'git branch --show-current') {
          callback(null, { stdout: 'feature/test\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const agentId = await service.getAgentId();
      expect(agentId).toBe('bedrock-agent-system-feature-test');
    });
  });
});