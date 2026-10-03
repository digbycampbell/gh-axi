import { encode } from '@toon-format/toon';
export function field(key, as) {
    return { type: 'field', key, as };
}
export function pluck(key, subkey, as) {
    return { type: 'pluck', key, subkey, as };
}
export function joinArray(key, subkey, as, empty = 'none') {
    return { type: 'joinArray', key, subkey, as, empty };
}
export function relativeTime(key, as) {
    return { type: 'relativeTime', key, as };
}
export function boolYesNo(key, as) {
    return { type: 'boolYesNo', key, as };
}
export function mapEnum(key, map, fallback, as) {
    return { type: 'mapEnum', key, map, fallback, as };
}
export function lower(key, as) {
    return { type: 'lower', key, as };
}
export function checksSummary(key, as) {
    return { type: 'checksSummary', key, as };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- custom extractors are polymorphic by design
export function custom(as, fn) {
    return { type: 'custom', as, fn };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- items are JSON-parsed objects with dynamic keys
export function extract(item, schema) {
    const result = {};
    for (const def of schema) {
        const outputKey = def.as ?? ('key' in def ? def.key : def.as);
        switch (def.type) {
            case 'field':
                result[outputKey] = item[def.key] ?? null;
                break;
            case 'pluck':
                result[outputKey] = item[def.key]?.[def.subkey] ?? null;
                break;
            case 'joinArray': {
                const arr = item[def.key];
                if (Array.isArray(arr) && arr.length > 0) {
                    result[outputKey] = arr.map((x) => (typeof x === 'string' ? x : x[def.subkey])).join(',');
                }
                else {
                    result[outputKey] = def.empty ?? 'none';
                }
                break;
            }
            case 'relativeTime':
                result[outputKey] = formatRelativeTime(item[def.key]);
                break;
            case 'boolYesNo':
                result[outputKey] = item[def.key] ? 'yes' : 'no';
                break;
            case 'mapEnum': {
                const val = item[def.key];
                if (typeof val === 'string' && val !== '' && val in def.map) {
                    result[outputKey] = def.map[val];
                }
                else {
                    result[outputKey] = def.fallback ?? val ?? 'none';
                }
                break;
            }
            case 'lower':
                result[outputKey] = typeof item[def.key] === 'string' ? item[def.key].toLowerCase() : item[def.key];
                break;
            case 'checksSummary': {
                const checks = item[def.key];
                if (Array.isArray(checks) && checks.length > 0) {
                    const passed = checks.filter((c) => c.conclusion === 'SUCCESS' || c.conclusion === 'NEUTRAL').length;
                    result[outputKey] = `${passed}/${checks.length} pass`;
                }
                else {
                    result[outputKey] = 'none';
                }
                break;
            }
            case 'custom':
                result[outputKey] = def.fn(item);
                break;
            default: {
                const _exhaustive = def;
                throw new Error(`Unknown field type: ${_exhaustive.type}`);
            }
        }
    }
    return result;
}
/** Render a labeled list of items as TOON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- items are JSON-parsed objects with dynamic keys
export function renderList(label, items, schema) {
    const extracted = items.map((item) => extract(item, schema));
    return encode({ [label]: extracted });
}
/** Render a single labeled detail object as TOON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- items are JSON-parsed objects with dynamic keys
export function renderDetail(label, item, schema) {
    const extracted = extract(item, schema);
    return encode({ [label]: extracted });
}
/** Render help suggestions (manual formatting — encode() inlines primitive arrays). */
export function renderHelp(lines) {
    if (lines.length === 0)
        return '';
    const indented = lines.map((l) => `  ${l}`).join('\n');
    return `help[${lines.length}]:\n${indented}`;
}
/** Render an error in TOON format. */
export function renderError(message, code, suggestions = []) {
    const blocks = [encode({ error: message, code })];
    if (suggestions.length > 0) {
        blocks.push(renderHelp(suggestions));
    }
    return blocks.join('\n');
}
/** Combine multiple TOON blocks into a single output string. */
export function renderOutput(blocks) {
    return blocks.filter(Boolean).join('\n');
}
function formatRelativeTime(iso) {
    if (!iso)
        return 'unknown';
    const now = Date.now();
    const then = new Date(iso).getTime();
    if (isNaN(then))
        return 'unknown';
    const MS_PER_SECOND = 1000;
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / MS_PER_SECOND);
    if (diffSec < 60)
        return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60)
        return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24)
        return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30)
        return `${diffDay}d ago`;
    const diffMon = Math.floor(diffDay / 30);
    if (diffMon < 12)
        return `${diffMon}mo ago`;
    const diffYr = Math.floor(diffMon / 12);
    return `${diffYr}y ago`;
}
//# sourceMappingURL=toon.js.map