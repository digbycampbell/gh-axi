import type { RepoContext } from "./context.js";
import { type HostContext } from "./host.js";
interface SuggestionContext {
    domain: string;
    action: string;
    state?: string;
    isEmpty?: boolean;
    /** The entity number/id/tag for substitution */
    id?: string | number;
    repo?: RepoContext;
    host?: HostContext;
    /** Resolved --owner for owner-scoped domains (e.g. project) */
    owner?: string;
}
export declare function withSuggestionHost<T>(host: HostContext | undefined, callback: () => Promise<T>): Promise<T>;
export declare function getSuggestions(ctx: SuggestionContext): string[];
export {};
