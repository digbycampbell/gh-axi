import { AxiError, exitCodeForError } from "axi-sdk-js";
export type ErrorCode = "REPO_NOT_FOUND" | "NOT_FOUND" | "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION_ERROR" | "RATE_LIMITED" | "GH_NOT_INSTALLED" | "UNKNOWN";
export { AxiError, exitCodeForError };
export declare class StackError extends AxiError {
    readonly exitCode: number;
    constructor(message: string, exitCode: number, suggestions?: string[]);
}
export declare function mapGhError(stderr: string, exitCode: number): AxiError;
export declare function ghNotInstalledError(): AxiError;
