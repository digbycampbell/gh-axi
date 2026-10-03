export declare const ATTACH_MIN_GH_VERSION = "2.99.0";
export declare const ATTACH_FLAG = "--attach";
export declare const ATTACH_BODY_OPTIONS: {
    valueBoundaryFlags: string[];
};
export declare function attachBodyOptions(required: boolean): {
    required: boolean;
    valueBoundaryFlags: string[];
};
export declare function hasAttachmentFlag(args: string[]): boolean;
export declare function extractAttachmentUrls(body: string): string[];
export declare function collectAttachments(args: string[], mode: "get" | "take"): string[];
export declare function pushAttachments(ghArgs: string[], specs: string[]): void;
export declare function preserveAttachMutation<T>(mutationState: string, operation: () => Promise<T>): Promise<T>;
export declare function newAttachmentUrls(body: string | undefined, baselineBody?: string | undefined): string[];
export declare function renderAttachOutput(specs: string[], body: string | undefined, baselineBody?: string | undefined): string;
