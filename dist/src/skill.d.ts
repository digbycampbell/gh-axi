export declare const SKILL_DESCRIPTION: string;
export declare const SKILL_AUTHOR = "Kun Chen (kunchenguid)";
export declare const HERMES_TAGS: string[];
export declare const HERMES_CATEGORY = "devops";
export declare const MAX_SKILL_MARKDOWN_CHARS = 2500;
/**
 * Render the installable SKILL.md for the gh-axi skill.
 *
 * This is a discovery stub, not a copy of CLI guidance. Installed skills go
 * stale; `gh-axi` (dashboard), `gh-axi --help`, and `gh-axi <command> --help`
 * do not. Keep the body to what gh-axi is, when to reach for it, and pointers
 * at those commands.
 *
 * @returns full SKILL.md contents including YAML frontmatter
 */
export declare function createSkillMarkdown(): string;
