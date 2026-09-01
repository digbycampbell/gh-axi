/**
 * Field extractor definitions for transforming gh JSON into flat TOON-friendly objects.
 */
export type FieldDef = {
    type: 'field';
    key: string;
    as?: string;
} | {
    type: 'pluck';
    key: string;
    subkey: string;
    as?: string;
} | {
    type: 'joinArray';
    key: string;
    subkey: string;
    as?: string;
    empty?: string;
} | {
    type: 'relativeTime';
    key: string;
    as?: string;
} | {
    type: 'boolYesNo';
    key: string;
    as?: string;
} | {
    type: 'mapEnum';
    key: string;
    map: Record<string, string>;
    fallback?: string;
    as?: string;
} | {
    type: 'lower';
    key: string;
    as?: string;
} | {
    type: 'checksSummary';
    key: string;
    as?: string;
} | {
    type: 'custom';
    as: string;
    fn: (item: any) => any;
};
export declare function field(key: string, as?: string): FieldDef;
export declare function pluck(key: string, subkey: string, as?: string): FieldDef;
export declare function joinArray(key: string, subkey: string, as?: string, empty?: string): FieldDef;
export declare function relativeTime(key: string, as?: string): FieldDef;
export declare function boolYesNo(key: string, as?: string): FieldDef;
export declare function mapEnum(key: string, map: Record<string, string>, fallback?: string, as?: string): FieldDef;
export declare function lower(key: string, as?: string): FieldDef;
export declare function checksSummary(key: string, as?: string): FieldDef;
export declare function custom(as: string, fn: (item: any) => any): FieldDef;
export declare function extract(item: Record<string, any>, schema: FieldDef[]): Record<string, unknown>;
/** Render a labeled list of items as TOON. */
export declare function renderList(label: string, items: Record<string, any>[], schema: FieldDef[]): string;
/** Render a single labeled detail object as TOON. */
export declare function renderDetail(label: string, item: Record<string, any>, schema: FieldDef[]): string;
/** Render help suggestions (manual formatting — encode() inlines primitive arrays). */
export declare function renderHelp(lines: string[]): string;
/** Render an error in TOON format. */
export declare function renderError(message: string, code: string, suggestions?: string[]): string;
/** Combine multiple TOON blocks into a single output string. */
export declare function renderOutput(blocks: string[]): string;
