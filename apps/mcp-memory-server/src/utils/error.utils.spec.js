"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const error_utils_1 = require("./error.utils");
describe('Error Utils', () => {
    describe('getErrorMessage', () => {
        it('should extract message from Error instance', () => {
            const error = new Error('Test error message');
            expect((0, error_utils_1.getErrorMessage)(error)).toBe('Test error message');
        });
        it('should return string error as-is', () => {
            expect((0, error_utils_1.getErrorMessage)('String error')).toBe('String error');
        });
        it('should extract message from object with message property', () => {
            const errorObj = { message: 'Object error message' };
            expect((0, error_utils_1.getErrorMessage)(errorObj)).toBe('Object error message');
        });
        it('should return "Unknown error" for null', () => {
            expect((0, error_utils_1.getErrorMessage)(null)).toBe('Unknown error');
        });
        it('should return "Unknown error" for undefined', () => {
            expect((0, error_utils_1.getErrorMessage)(undefined)).toBe('Unknown error');
        });
        it('should return "Unknown error" for number', () => {
            expect((0, error_utils_1.getErrorMessage)(42)).toBe('Unknown error');
        });
        it('should return "Unknown error" for object without message', () => {
            expect((0, error_utils_1.getErrorMessage)({ code: 500 })).toBe('Unknown error');
        });
        it('should return "Unknown error" for object with non-string message', () => {
            expect((0, error_utils_1.getErrorMessage)({ message: 123 })).toBe('Unknown error');
        });
    });
    describe('getErrorName', () => {
        it('should extract name from Error instance', () => {
            const error = new TypeError('Type error');
            expect((0, error_utils_1.getErrorName)(error)).toBe('TypeError');
        });
        it('should extract name from object with name property', () => {
            const errorObj = { name: 'CustomError', message: 'Custom error' };
            expect((0, error_utils_1.getErrorName)(errorObj)).toBe('CustomError');
        });
        it('should return "UnknownError" for string', () => {
            expect((0, error_utils_1.getErrorName)('String error')).toBe('UnknownError');
        });
        it('should return "UnknownError" for object without name', () => {
            expect((0, error_utils_1.getErrorName)({ message: 'Error message' })).toBe('UnknownError');
        });
        it('should return "UnknownError" for object with non-string name', () => {
            expect((0, error_utils_1.getErrorName)({ name: 123 })).toBe('UnknownError');
        });
    });
    describe('getErrorStack', () => {
        it('should extract stack from Error instance', () => {
            const error = new Error('Test error');
            const stack = (0, error_utils_1.getErrorStack)(error);
            expect(stack).toBeDefined();
            expect(typeof stack).toBe('string');
            expect(stack).toContain('Error: Test error');
        });
        it('should extract stack from object with stack property', () => {
            const errorObj = { stack: 'Custom stack trace' };
            expect((0, error_utils_1.getErrorStack)(errorObj)).toBe('Custom stack trace');
        });
        it('should return undefined for string error', () => {
            expect((0, error_utils_1.getErrorStack)('String error')).toBeUndefined();
        });
        it('should return undefined for object without stack', () => {
            expect((0, error_utils_1.getErrorStack)({ message: 'Error message' })).toBeUndefined();
        });
        it('should return undefined for object with non-string stack', () => {
            expect((0, error_utils_1.getErrorStack)({ stack: 123 })).toBeUndefined();
        });
    });
    describe('isError', () => {
        it('should return true for Error instance', () => {
            expect((0, error_utils_1.isError)(new Error('Test'))).toBe(true);
            expect((0, error_utils_1.isError)(new TypeError('Type error'))).toBe(true);
            expect((0, error_utils_1.isError)(new ReferenceError('Reference error'))).toBe(true);
        });
        it('should return false for non-Error types', () => {
            expect((0, error_utils_1.isError)('string')).toBe(false);
            expect((0, error_utils_1.isError)(123)).toBe(false);
            expect((0, error_utils_1.isError)(null)).toBe(false);
            expect((0, error_utils_1.isError)(undefined)).toBe(false);
            expect((0, error_utils_1.isError)({})).toBe(false);
            expect((0, error_utils_1.isError)({ message: 'Not an error' })).toBe(false);
        });
    });
    describe('getErrorInfo', () => {
        it('should extract complete info from Error instance', () => {
            const error = new TypeError('Type error message');
            const info = (0, error_utils_1.getErrorInfo)(error);
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
            const info = (0, error_utils_1.getErrorInfo)(errorObj);
            expect(info.message).toBe('Custom error message');
            expect(info.name).toBe('CustomError');
            expect(info.stack).toBe('Custom stack trace');
        });
        it('should provide defaults for incomplete error info', () => {
            const info = (0, error_utils_1.getErrorInfo)('String error');
            expect(info.message).toBe('String error');
            expect(info.name).toBe('UnknownError');
            expect(info.stack).toBeUndefined();
        });
        it('should handle unknown error types', () => {
            const info = (0, error_utils_1.getErrorInfo)(42);
            expect(info.message).toBe('Unknown error');
            expect(info.name).toBe('UnknownError');
            expect(info.stack).toBeUndefined();
        });
    });
});
//# sourceMappingURL=error.utils.spec.js.map