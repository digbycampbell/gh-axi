/**
 * Convert a bare gist id or a gist URL to a bare id.
 *
 * Accepts three URL shapes:
 *   gist.github.com/OWNER/ID       (owner-scoped)
 *   gist.github.com/ID             (ownerless)
 *   ghe.example.com/gist/OWNER/ID  (GHE — last segment is always the id)
 *
 * Takes the **last non-empty path segment** across all shapes. gh's own
 * GistIDFromURL takes path segment index 2, which returns OWNER for the GHE
 * shape — that is wrong. Last-segment handles all three correctly.
 *
 * The URL's host is validated against the configured host (GH_HOST > github.com).
 * Both `<host>` and `gist.<host>` are accepted as valid origins.
 */
export declare function gistIdFromSelector(selector: string): string;
