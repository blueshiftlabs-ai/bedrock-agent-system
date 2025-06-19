import { 
  getErrorMessage, 
  getErrorName, 
  getErrorStack, 
  isError, 
  getErrorInfo 
} from './error.utils';

describe('Error Utils', () => {
  describe('getErrorMessage', () => {
    it('should extract message from Error instance', () => {
      const error = new Error('Test error message');
      expect(getErrorMessage(error)).toBe('Test error message');
    });

    it('should return string error as-is', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('should extract message from object with message property', () => {
      const errorObj = { message: 'Object error message' };
      expect(getErrorMessage(errorObj)).toBe('Object error message');
    });

    it('should return "Unknown error" for null', () => {
      expect(getErrorMessage(null)).toBe('Unknown error');
    });

    it('should return "Unknown error" for undefined', () => {
      expect(getErrorMessage(undefined)).toBe('Unknown error');
    });

    it('should return "Unknown error" for number', () => {
      expect(getErrorMessage(42)).toBe('Unknown error');
    });

    it('should return "Unknown error" for object without message', () => {
      expect(getErrorMessage({ code: 500 })).toBe('Unknown error');
    });

    it('should return "Unknown error" for object with non-string message', () => {
      expect(getErrorMessage({ message: 123 })).toBe('Unknown error');
    });
  });

  describe('getErrorName', () => {
    it('should extract name from Error instance', () => {
      const error = new TypeError('Type error');
      expect(getErrorName(error)).toBe('TypeError');
    });

    it('should extract name from object with name property', () => {
      const errorObj = { name: 'CustomError', message: 'Custom error' };
      expect(getErrorName(errorObj)).toBe('CustomError');
    });

    it('should return "UnknownError" for string', () => {
      expect(getErrorName('String error')).toBe('UnknownError');
    });

    it('should return "UnknownError" for object without name', () => {
      expect(getErrorName({ message: 'Error message' })).toBe('UnknownError');
    });

    it('should return "UnknownError" for object with non-string name', () => {
      expect(getErrorName({ name: 123 })).toBe('UnknownError');
    });
  });

  describe('getErrorStack', () => {
    it('should extract stack from Error instance', () => {
      const error = new Error('Test error');
      const stack = getErrorStack(error);
      expect(stack).toBeDefined();
      expect(typeof stack).toBe('string');
      expect(stack).toContain('Error: Test error');
    });

    it('should extract stack from object with stack property', () => {
      const errorObj = { stack: 'Custom stack trace' };
      expect(getErrorStack(errorObj)).toBe('Custom stack trace');
    });

    it('should return undefined for string error', () => {
      expect(getErrorStack('String error')).toBeUndefined();
    });

    it('should return undefined for object without stack', () => {
      expect(getErrorStack({ message: 'Error message' })).toBeUndefined();
    });

    it('should return undefined for object with non-string stack', () => {
      expect(getErrorStack({ stack: 123 })).toBeUndefined();
    });
  });

  describe('isError', () => {
    it('should return true for Error instance', () => {
      expect(isError(new Error('Test'))).toBe(true);
      expect(isError(new TypeError('Type error'))).toBe(true);
      expect(isError(new ReferenceError('Reference error'))).toBe(true);
    });

    it('should return false for non-Error types', () => {
      expect(isError('string')).toBe(false);
      expect(isError(123)).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
      expect(isError({})).toBe(false);
      expect(isError({ message: 'Not an error' })).toBe(false);
    });
  });

  describe('getErrorInfo', () => {
    it('should extract complete info from Error instance', () => {
      const error = new TypeError('Type error message');
      const info = getErrorInfo(error);
      
      expect(info.message).toBe('Type error message');
      expect(info.name).toBe('TypeError');
      expect(info.stack).toBeDefined();
      expect(typeof info.stack).toBe('string');
    });

    it('should extract complete info from error-like object', () => {
      const errorObj = {
        message: 'Custom error message',
        name: 'CustomError',
        stack: 'Custom stack trace'
      };
      const info = getErrorInfo(errorObj);
      
      expect(info.message).toBe('Custom error message');
      expect(info.name).toBe('CustomError');
      expect(info.stack).toBe('Custom stack trace');
    });

    it('should provide defaults for incomplete error info', () => {
      const info = getErrorInfo('String error');
      
      expect(info.message).toBe('String error');
      expect(info.name).toBe('UnknownError');
      expect(info.stack).toBeUndefined();
    });

    it('should handle unknown error types', () => {
      const info = getErrorInfo(42);
      
      expect(info.message).toBe('Unknown error');
      expect(info.name).toBe('UnknownError');
      expect(info.stack).toBeUndefined();
    });
  });
});