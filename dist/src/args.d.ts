/** Get a flag's value from --flag value or --flag=value without modifying args. */
export declare function getFlag(args: string[], name: string): string | undefined;
/** Get a flag's value from --flag value or --flag=value and remove it from args. */
export declare function takeFlag(args: string[], flag: string): string | undefined;
/** Check if a boolean flag is present. */
export declare function hasFlag(args: string[], flag: string): boolean;
/** Check if a boolean flag is present and remove it from args. */
export declare function takeBoolFlag(args: string[], flag: string): boolean;
/**
 * Collect all values for a repeatable flag in --flag value or --flag=value form
 * without modifying args. Throws VALIDATION_ERROR if any occurrence has a
 * missing or blank value, rather than silently dropping it.
 */
export declare function getAllFlags(args: string[], flag: string): string[];
/** Like getAllFlags, but also removes every occurrence from args. */
export declare function takeAllFlags(args: string[], flag: string): string[];
/** Append a repeatable flag once per value onto a gh argv array. */
export declare function pushRepeated(ghArgs: string[], flag: string, values: string[]): void;
/** Get the first positional arg (non-flag) starting from startIndex. */
export declare function getPositional(args: string[], startIndex: number): string | undefined;
/** Parse and validate a required numeric argument. */
export declare function requireNumber(raw: string | undefined, label: string): number;
/** Find the first numeric positional arg, remove it from args, and return it as a number. */
export declare function takeNumber(args: string[], label: string): number;
/**
 * Reject flags in `args` that are not listed in `known`, after the subcommand
 * has parsed the flags it recognizes. Positionals and `--help`/`-h` always
 * pass; `--` ends flag scanning. Value forms (`--flag=v`) are matched by flag
 * name only. Throws VALIDATION_ERROR listing every offending flag plus a
 * one-turn self-correction hint (usage + `--help`), per AXI principle 6:
 * never silently drop an unknown flag.
 */
export declare function rejectUnknownFlags(args: string[], known: readonly string[], command: string, sub: string): void;
