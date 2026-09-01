import { type HostContext } from "./host.js";
export interface RepoContext {
    owner: string;
    name: string;
    /** Full "OWNER/NAME" string */
    nwo: string;
    /** How the repo was resolved — determines whether to append --repo to gh calls */
    source: "flag" | "env" | "git";
    host?: HostContext;
}
/**
 * Resolve the target repository.
 * Priority: --repo flag > GH_REPO env > git remote origin.
 */
export declare function resolveRepo(flagValue?: string): RepoContext | undefined;
