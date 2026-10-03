import { type RepoContext } from "./context.js";
export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
/** Override the wrapped `gh` binary. Unset or blank keeps PATH lookup (`gh`). */
export declare function resolveGhBin(): string;
/** Execute gh and return parsed JSON. */
export declare function ghJson<T = unknown>(args: string[], ctx?: RepoContext): Promise<T>;
export declare function ensureAttachmentSupport(): Promise<void>;
/** Execute gh and return raw stdout. */
export declare function ghExec(args: string[], ctx?: RepoContext): Promise<string>;
export declare function ghExecWithAttachmentState(args: string[], ctx?: RepoContext): Promise<string>;
/** Execute gh, returning stdout + stderr without throwing on non-zero exit. */
export declare function ghRaw(args: string[], ctx?: RepoContext): Promise<ExecResult>;
/**
 * Execute gh, writing `input` to the child's stdin instead of a CLI flag.
 * Keeps sensitive values (secret/variable bodies) out of the argv gh receives.
 */
export declare function ghExecWithStdin(args: string[], input: string, ctx?: RepoContext): Promise<string>;
