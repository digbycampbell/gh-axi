import type { RepoContext } from '../context.js';
export declare const WORKFLOW_HELP = "usage: gh-axi workflow <subcommand> [flags]\nsubcommands[5]:\n  list, view <id|name>, run <id|name>, enable <id|name>, disable <id|name>\nflags{list}:\n  --limit <n> (default 20), --all\nflags{run}:\n  --ref <git-ref>, --field <key=val> (repeatable)\nexamples:\n  gh-axi workflow list\n  gh-axi workflow run ci.yml --ref main\n  gh-axi workflow disable 12345";
export declare function workflowCommand(args: string[], ctx?: RepoContext): Promise<string>;
