import { execFile } from "node:child_process";
import { AxiError, ghNotInstalledError, mapGhError } from "./errors.js";
function buildArgs(args, ctx) {
    const out = [...args];
    // Append --repo for flag/env sources (git remote is auto-detected by gh)
    if (ctx && ctx.source !== "git") {
        out.push("--repo", ctx.nwo);
    }
    return out;
}
const MAX_BUFFER_BYTES = 10 * 1024 * 1024; // 10 MB
function toExecResult(resolve) {
    return (error, stdout, stderr) => {
        if (error && error.code === "ENOENT") {
            resolve({ stdout: "", stderr: "ENOENT", exitCode: 127 });
            return;
        }
        const exitCode = error
            ? (error.code ?? 1)
            : 0;
        resolve({
            stdout: stdout ?? "",
            stderr: stderr ?? "",
            exitCode: typeof exitCode === "number" ? exitCode : 1,
        });
    };
}
function run(args) {
    return new Promise((resolve) => {
        execFile("gh", args, { maxBuffer: MAX_BUFFER_BYTES }, toExecResult(resolve));
    });
}
/** Run gh, writing `input` to the child process's stdin instead of the CLI's own. */
function runWithStdin(args, input) {
    return new Promise((resolve) => {
        const child = execFile("gh", args, { maxBuffer: MAX_BUFFER_BYTES }, toExecResult(resolve));
        child.stdin?.end(input);
    });
}
/** Execute gh and return parsed JSON. */
export async function ghJson(args, ctx) {
    const result = await run(buildArgs(args, ctx));
    if (result.stderr === "ENOENT")
        throw ghNotInstalledError();
    if (result.exitCode !== 0)
        throw mapGhError(result.stderr, result.exitCode);
    try {
        return JSON.parse(result.stdout);
    }
    catch {
        throw new AxiError(`Unexpected gh output: ${result.stdout.slice(0, 200)}`, "UNKNOWN");
    }
}
/** Execute gh and return raw stdout. */
export async function ghExec(args, ctx) {
    const result = await run(buildArgs(args, ctx));
    if (result.stderr === "ENOENT")
        throw ghNotInstalledError();
    if (result.exitCode !== 0)
        throw mapGhError(result.stderr, result.exitCode);
    return result.stdout;
}
/** Execute gh, returning stdout + stderr without throwing on non-zero exit. */
export async function ghRaw(args, ctx) {
    const result = await run(buildArgs(args, ctx));
    if (result.stderr === "ENOENT")
        throw ghNotInstalledError();
    return result;
}
/**
 * Execute gh, writing `input` to the child's stdin instead of a CLI flag.
 * Keeps sensitive values (secret/variable bodies) out of the argv gh receives.
 */
export async function ghExecWithStdin(args, input, ctx) {
    const result = await runWithStdin(buildArgs(args, ctx), input);
    if (result.stderr === "ENOENT")
        throw ghNotInstalledError();
    if (result.exitCode !== 0)
        throw mapGhError(result.stderr, result.exitCode);
    return result.stdout;
}
//# sourceMappingURL=gh.js.map