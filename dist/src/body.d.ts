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
 * Resolve a command body from inline text or a UTF-8 file and remove the flags.
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
