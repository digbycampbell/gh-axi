import { execFile } from "node:child_process";
import { ATTACH_MIN_GH_VERSION } from "./attach.js";
import { AttachmentMutationError, AxiError, ghNotInstalledError, mapGhError, } from "./errors.js";
function buildArgs(args, ctx) {
    const out = [...args];
    // Append --repo for flag/env sources (git remote is auto-detected by gh)
    if (ctx && ctx.source !== "git") {
        out.push("--repo", ctx.nwo);
    }
    return out;
}
const MAX_BUFFER_BYTES = 10 * 1024 * 1024; // 10 MB
/** Override the wrapped `gh` binary. Unset or blank keeps PATH lookup (`gh`). */
export function resolveGhBin() {
    const fromEnv = process.env["GH_BIN"]?.trim();
    return fromEnv && fromEnv.length > 0 ? fromEnv : "gh";
}
function missingGhError() {
    const overridden = process.env["GH_BIN"]?.trim();
    if (overridden) {
        return new AxiError(`GH_BIN is not an executable gh binary: ${overridden}`, "GH_NOT_INSTALLED");
    }
    return ghNotInstalledError();
}
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
        execFile(resolveGhBin(), args, { maxBuffer: MAX_BUFFER_BYTES }, toExecResult(resolve));
    });
}
/** Run gh, writing `input` to the child process's stdin instead of the CLI's own. */
function runWithStdin(args, input) {
    return new Promise((resolve) => {
        const child = execFile(resolveGhBin(), args, { maxBuffer: MAX_BUFFER_BYTES }, toExecResult(resolve));
        child.stdin?.end(input);
    });
}
/** Execute gh and return parsed JSON. */
export async function ghJson(args, ctx) {
    const result = await run(buildArgs(args, ctx));
    if (result.stderr === "ENOENT")
        throw missingGhError();
    if (result.exitCode !== 0)
        throw mapGhError(result.stderr, result.exitCode);
    try {
        return JSON.parse(result.stdout);
    }
    catch {
        throw new AxiError(`Unexpected gh output: ${result.stdout.slice(0, 200)}`, "UNKNOWN");
    }
}
function versionAtLeast(actual, required) {
    for (let index = 0; index < required.length; index++) {
        if ((actual[index] ?? 0) > required[index])
            return true;
        if ((actual[index] ?? 0) < required[index])
            return false;
    }
    return true;
}
export async function ensureAttachmentSupport() {
    const result = await run(["--version"]);
    if (result.stderr === "ENOENT")
        throw missingGhError();
    if (result.exitCode !== 0)
        throw mapGhError(result.stderr, result.exitCode);
    const installed = result.stdout.match(/gh version (\d+)\.(\d+)\.(\d+)/);
    if (!installed) {
        throw new AxiError(`Could not determine installed gh version; --attach requires gh ${ATTACH_MIN_GH_VERSION}+`, "VALIDATION_ERROR");
    }
    const actual = installed.slice(1).map(Number);
    const required = ATTACH_MIN_GH_VERSION.split(".").map(Number);
    const supported = versionAtLeast(actual, required);
    if (!supported) {
        throw new AxiError(`--attach requires gh ${ATTACH_MIN_GH_VERSION}+; installed gh ${installed[1]}.${installed[2]}.${installed[3]}`, "VALIDATION_ERROR", [
            `Upgrade gh to ${ATTACH_MIN_GH_VERSION} or newer`,
            `Or point GH_BIN at a ${ATTACH_MIN_GH_VERSION}+ gh binary`,
        ]);
    }
}
/** Execute gh and return raw stdout. */
export async function ghExec(args, ctx) {
    const result = await run(buildArgs(args, ctx));
    if (result.stderr === "ENOENT")
        throw missingGhError();
    if (result.exitCode !== 0) {
        // Some gh subcommands (e.g. `run watch --exit-status` on a completed
        // failed run) write their failure diagnostics to stdout and leave stderr
        // empty, so fall back to stdout to keep the actionable output visible.
        // gh writes progress lines first and the failure summary at the end of
        // the stream, so the fallback takes the last non-empty stdout line.
        throw mapGhError(result.stderr || lastNonEmptyLine(result.stdout), result.exitCode);
    }
    return result.stdout;
}
function lastNonEmptyLine(text) {
    const lines = text.split("\n").filter((line) => line.trim() !== "");
    return lines[lines.length - 1] ?? "";
}
export async function ghExecWithAttachmentState(args, ctx) {
    const result = await run(buildArgs(args, ctx));
    if (result.stderr === "ENOENT")
        throw missingGhError();
    if (result.exitCode !== 0) {
        const error = mapGhError(result.stderr, result.exitCode);
        const mutationUrl = result.stdout.match(/https?:\/\/[^\s]+/)?.[0];
        if (!mutationUrl)
            throw error;
        throw new AttachmentMutationError(result.stdout, mutationUrl, error);
    }
    return result.stdout;
}
/** Execute gh, returning stdout + stderr without throwing on non-zero exit. */
export async function ghRaw(args, ctx) {
    const result = await run(buildArgs(args, ctx));
    if (result.stderr === "ENOENT")
        throw missingGhError();
    return result;
}
/**
 * Execute gh, writing `input` to the child's stdin instead of a CLI flag.
 * Keeps sensitive values (secret/variable bodies) out of the argv gh receives.
 */
export async function ghExecWithStdin(args, input, ctx) {
    const result = await runWithStdin(buildArgs(args, ctx), input);
    if (result.stderr === "ENOENT")
        throw missingGhError();
    if (result.exitCode !== 0)
        throw mapGhError(result.stderr, result.exitCode);
    return result.stdout;
}
//# sourceMappingURL=gh.js.map