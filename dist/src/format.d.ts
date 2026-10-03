/**
 * Shared formatting helpers for consistent count and truncation phrasing.
 *
 * Standard phrases:
 *   count: N                                — simple count
 *   count: N of T total                     — when a total of at least N is known
 *   count: N (showing first N)              — when truncated by limit
 *   count: N+ (GitHub search API limit reached) — search API limit
 */
export interface CountLineOptions {
    /** Number of items returned / displayed. */
    count: number;
    /** The request limit; when count === limit, results may be truncated. */
    limit?: number;
    /** True total count from an API (e.g. GraphQL totalCount). */
    totalCount?: number;
    /** Whether the API limit was reached (search-specific). */
    apiLimitHit?: boolean;
    /** Display limit that further truncates results for output. */
    displayLimit?: number;
}
export declare function formatCountLine(opts: CountLineOptions): string;
