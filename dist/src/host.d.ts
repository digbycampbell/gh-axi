/** Default GitHub host used when none is configured. */
export declare const DEFAULT_HOST = "github.com";
export interface HostContext {
    value: string;
    source: "flag" | "env" | "default";
}
/**
 * Resolve the effective GitHub host.
 * Priority: explicit --hostname flag > GH_HOST env > github.com.
 *
 * The resolved host feeds two places: the child `gh` process (via the GH_HOST
 * env var, which the child inherits) and the URLs gh-axi parses or builds.
 */
export declare function resolveHost(flagValue?: string): string;
/** Escape a host so it can be embedded literally in a RegExp. */
export declare function escapeRegExp(value: string): string;
