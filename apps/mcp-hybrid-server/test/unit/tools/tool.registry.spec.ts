import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MCPToolRegistry } from '../../../src/tools/registry/tool.registry';

describe('MCPToolRegistry', () => {
  let registry: MCPToolRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [MCPToolRegistry],
    }).compile();

    registry = module.get<MCPToolRegistry>(MCPToolRegistry);
  });

  it('should be defined', () => {
    expect(registry).toBeDefined();
  });

  it('should register tools', () => {
    const tool = {
      name: 'test-tool',
      description: 'A test tool',
      category: 'test',
      parameters: {
        type: 'object',
        required: [],
        properties: {},
      },
      execute: async () => ({ success: true }),
    };

    registry.registerTool(tool);
    expect(registry.getTool('test-tool')).toBeDefined();
  });

  it('should get tools by category', () => {
    const tool1 = {
      name: 'test-tool-1',
      description: 'A test tool',
      category: 'test',
      parameters: { type: 'object', required: [], properties: {} },
      execute: async () => ({ success: true }),
    };

    const tool2 = {
      name: 'test-tool-2',
      description: 'Another test tool',
      category: 'analysis',
      parameters: { type: 'object', required: [], properties: {} },
      execute: async () => ({ success: true }),
    };

    registry.registerTool(tool1);
    registry.registerTool(tool2);

    const testTools = registry.getToolsByCategory('test');
    expect(testTools).toHaveLength(1);
    expect(testTools[0].name).toBe('test-tool-1');
  });

  it('should find relevant tools', () => {
    const tool = {
      name: 'analyze-code',
      description: 'Analyzes code files',
      category: 'analysis',
      parameters: { type: 'object', required: [], properties: {} },
      execute: async () => ({ success: true }),
    };

    registry.registerTool(tool);

    const relevantTools = registry.getRelevantTools('I want to analyze my code');
    expect(relevantTools.length).toBeGreaterThan(0);
    expect(relevantTools[0].name).toBe('analyze-code');
  });
});
