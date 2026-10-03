/**
 * Read all of this process's piped stdin synchronously as a UTF-8 string.
 * Callers must check `isStdinTTY()` first so an interactive shell never blocks.
 */
export declare function readStdinSync(): string;
/** Read all of this process's stdin as a UTF-8 string. */
export declare function readStdin(): Promise<string>;
/**
 * Whether stdin is an interactive terminal (no piped input available).
 * Checks fd 0 directly: touching `process.stdin` wraps a pipe in a socket that
 * switches it to non-blocking, so a later `readStdinSync()` could hit EAGAIN.
 */
export declare function isStdinTTY(): boolean;
