export declare function getErrorMessage(error: unknown): string;
export declare function getErrorName(error: unknown): string;
export declare function getErrorStack(error: unknown): string | undefined;
export declare function isError(error: unknown): error is Error;
export interface ErrorInfo {
    message: string;
    name: string;
    stack?: string;
}
export declare function getErrorInfo(error: unknown): ErrorInfo;
//# sourceMappingURL=error.utils.d.ts.map