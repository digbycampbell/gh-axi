import { AxiError } from './errors.js';
/**
 * Parse a --fields value (comma-separated field names), validate against
 * the available map, and return the extra FieldDefs and JSON keys.
 *
 * Returns empty arrays when fieldsArg is undefined (no --fields passed).
 * Throws AxiError with VALIDATION_ERROR for any unknown field names.
 */
export function parseFields(fieldsArg, available) {
    if (fieldsArg === undefined) {
        return { extraDefs: [], extraJsonKeys: [] };
    }
    const requested = [...new Set(fieldsArg.split(',').map((f) => f.trim()).filter(Boolean))];
    const unknown = requested.filter((f) => !(f in available));
    if (unknown.length > 0) {
        const availableNames = Object.keys(available).sort().join(', ');
        throw new AxiError(`Unknown field(s): ${unknown.join(', ')}. Available: ${availableNames}`, 'VALIDATION_ERROR');
    }
    const extraDefs = [];
    const extraJsonKeys = [];
    for (const name of requested) {
        const spec = available[name];
        extraDefs.push(spec.def);
        extraJsonKeys.push(spec.jsonKey);
    }
    return { extraDefs, extraJsonKeys };
}
//# sourceMappingURL=fields.js.map