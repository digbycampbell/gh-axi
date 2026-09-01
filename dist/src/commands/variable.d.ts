import type { RepoContext } from "../context.js";
export declare const VARIABLE_HELP = "usage: gh-axi variable <subcommand> [flags]\nsubcommands[3]:\n  list, set <name>, delete <name>\nflags{set}:\n  --body/-b <value> (reads from stdin if omitted)\nexamples:\n  gh-axi variable list\n  gh-axi variable set NODE_ENV --body production\n  echo -n \"production\" | gh-axi variable set NODE_ENV\n  gh-axi variable delete NODE_ENV";
export declare function variableCommand(args: string[], ctx?: RepoContext): Promise<string>;
