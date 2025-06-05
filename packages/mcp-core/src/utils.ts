/**
 * Utility functions for MCP operations
 */

export function validateToolInput(input: any, schema: Record<string, any>): boolean {
  // Basic schema validation - could be enhanced with ajv or similar
  if (!schema.properties) return true;
  
  for (const [key, property] of Object.entries(schema.properties)) {
    const prop = property as any;
    if (prop.required && !(key in input)) {
      return false;
    }
  }
  
  return true;
}

export function generateToolSchema(tool: {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}): Record<string, any> {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [name, param] of Object.entries(tool.parameters)) {
    properties[name] = {
      type: param.type,
      description: param.description,
    };
    
    if (param.required) {
      required.push(name);
    }
  }

  return {
    type: 'object',
    properties,
    required,
  };
}

export function createMemoryId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createWorkflowId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function parseS3Url(s3Url: string): { bucket: string; key: string } | null {
  const match = s3Url.match(/^s3:\/\/([^\/]+)\/(.+)$/);
  if (!match) return null;
  
  return {
    bucket: match[1],
    key: match[2],
  };
}

export function buildS3Url(bucket: string, key: string): string {
  return `s3://${bucket}/${key}`;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}