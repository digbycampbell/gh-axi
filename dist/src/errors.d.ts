import { AxiError, exitCodeForError } from "axi-sdk-js";
export type ErrorCode = "REPO_NOT_FOUND" | "NOT_FOUND" | "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION_ERROR" | "RATE_LIMITED" | "GH_NOT_INSTALLED" | "UNKNOWN";
export { AxiError, exitCodeForError };
export declare class MutationFollowupError extends AxiError {
    readonly mutationState: string;
    readonly followupError: AxiError;
    constructor(mutationState: string, followupError: AxiError);
    static from(mutationState: string, error: unknown): MutationFollowupError;
}
export declare class OperationOutcomeError extends AxiError {
    readonly operationOutcomes: Record<string, string>;
    readonly assetUrls: string[];
    constructor(error: AxiError, operationOutcomes: Record<string, string>, assetUrls?: string[]);
}
export declare class AttachmentMutationError extends OperationOutcomeError {
    readonly stdout: string;
    readonly mutationUrl: string;
    readonly attachmentError: AxiError;
    readonly followupError?: AxiError | undefined;
    constructor(stdout: string, mutationUrl: string, attachmentError: AxiError, followupError?: AxiError | undefined, operationOutcomes?: Record<string, string>, assetUrls?: string[]);
    withFollowupError(error: unknown): AttachmentMutationError;
    withResults(assetUrls: string[], operationOutcomes?: Record<string, string>): AttachmentMutationError;
}
export declare class StackError extends AxiError {
    readonly exitCode: number;
    constructor(message: string, exitCode: number, suggestions?: string[]);
}
export declare function mapGhError(stderr: string, exitCode: number): AxiError;
export declare function ghNotInstalledError(): AxiError;
