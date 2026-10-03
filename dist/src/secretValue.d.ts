/**
 * Resolve a secret/variable value from an already-extracted flag value,
 * or from piped stdin.
 * Secret callers pass no flag value so secrets are stdin-only.
 * Never accepts an interactive TTY prompt.
 */
export declare function resolveValue(flagValue: string | undefined, noun: "secret" | "variable"): Promise<string>;
