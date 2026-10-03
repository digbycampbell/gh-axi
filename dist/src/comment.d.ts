import type { RepoContext } from "./context.js";
export interface CreatedComment {
    [key: string]: unknown;
    author?: {
        login: string;
    };
    body?: string;
    createdAt?: string;
}
export declare function fetchCreatedComment(output: string, ctx?: RepoContext): Promise<CreatedComment>;
