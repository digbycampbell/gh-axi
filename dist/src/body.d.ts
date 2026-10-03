interface TakeBodyOptions {
    required?: boolean;
    inlineFlags?: string[];
    fileFlags?: string[];
    valueBoundaryFlags?: string[];
    label?: string;
    suggestions?: string[];
}
interface TruncateBodyOptions {
    fullHint?: string;
    originalHint?: string;
}
/**
 * Read a body from piped stdin for the `-` sentinel (gh's own convention).
 * AXI commands must never hang waiting for input, so an interactive TTY is
 * refused before any read.
 */
export declare function readBodyStdin(flag: string, suggestions: string[]): string;
/**
 * Resolve a command body from inline text, a UTF-8 file, or piped stdin (a
 * file flag value of `-`) and remove the flags.
 *
 * Optional bodies accept at most one source. Required bodies enforce exactly
 * one source and raise validation errors for missing, conflicting, or
 * unreadable input.
 */
export declare function takeBody(args: string[], options: TakeBodyOptions & {
    required: true;
}): string;
export declare function takeBody(args: string[], options?: TakeBodyOptions): string | undefined;
/** Clean up a body string to reduce token cost before truncation. */
export declare function cleanBody(text: string): string;
/**
 * Truncate a body field for display.
 * Cleanups are only applied when truncation is needed.
 * Returns the raw body when it fits within maxLen.
 * Custom hints let callers avoid suggesting unavailable escape hatches.
 */
export declare function truncateBody(body: unknown, maxLen?: number, options?: TruncateBodyOptions): string;
export {};
