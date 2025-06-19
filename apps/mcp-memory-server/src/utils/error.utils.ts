/**
 * Error handling utilities for TypeScript strict mode compliance
 * Provides safe error message extraction and error type checking
 */

/**
 * Safely extract error message from unknown error types
 * Compatible with TypeScript strict mode where catch errors are typed as unknown
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  
  return 'Unknown error';
}

/**
 * Safely extract error name from unknown error types
 */
export function getErrorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }
  
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name: unknown }).name;
    if (typeof name === 'string') {
      return name;
    }
  }
  
  return 'UnknownError';
}

/**
 * Safely extract error stack from unknown error types
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  
  if (error && typeof error === 'object' && 'stack' in error) {
    const stack = (error as { stack: unknown }).stack;
    if (typeof stack === 'string') {
      return stack;
    }
  }
  
  return undefined;
}

/**
 * Type guard to check if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Create a standardized error info object from unknown error
 */
export interface ErrorInfo {
  message: string;
  name: string;
  stack?: string;
}

export function getErrorInfo(error: unknown): ErrorInfo {
  return {
    message: getErrorMessage(error),
    name: getErrorName(error),
    stack: getErrorStack(error),
  };
}