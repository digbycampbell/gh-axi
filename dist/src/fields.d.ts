import type { FieldDef } from './toon.js';
/**
 * Describes an extra field that can be requested via --fields.
 * `jsonKey` is the gh JSON field name to add to the --json arg.
 * `def` is the FieldDef used to extract/format the value.
 */
export interface ExtraFieldSpec {
    jsonKey: string;
    def: FieldDef;
}
export interface ParseFieldsResult {
    extraDefs: FieldDef[];
    extraJsonKeys: string[];
}
/**
 * Parse a --fields value (comma-separated field names), validate against
 * the available map, and return the extra FieldDefs and JSON keys.
 *
 * Returns empty arrays when fieldsArg is undefined (no --fields passed).
 * Throws AxiError with VALIDATION_ERROR for any unknown field names.
 */
export declare function parseFields(fieldsArg: string | undefined, available: Record<string, ExtraFieldSpec>): ParseFieldsResult;
