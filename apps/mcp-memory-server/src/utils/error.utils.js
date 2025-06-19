"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorMessage = getErrorMessage;
exports.getErrorName = getErrorName;
exports.getErrorStack = getErrorStack;
exports.isError = isError;
exports.getErrorInfo = getErrorInfo;
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        const message = error.message;
        if (typeof message === 'string') {
            return message;
        }
    }
    return 'Unknown error';
}
function getErrorName(error) {
    if (error instanceof Error) {
        return error.name;
    }
    if (error && typeof error === 'object' && 'name' in error) {
        const name = error.name;
        if (typeof name === 'string') {
            return name;
        }
    }
    return 'UnknownError';
}
function getErrorStack(error) {
    if (error instanceof Error) {
        return error.stack;
    }
    if (error && typeof error === 'object' && 'stack' in error) {
        const stack = error.stack;
        if (typeof stack === 'string') {
            return stack;
        }
    }
    return undefined;
}
function isError(error) {
    return error instanceof Error;
}
function getErrorInfo(error) {
    return {
        message: getErrorMessage(error),
        name: getErrorName(error),
        stack: getErrorStack(error),
    };
}
//# sourceMappingURL=error.utils.js.map