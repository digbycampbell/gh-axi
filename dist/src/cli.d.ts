export declare const DESCRIPTION = "Agent ergonomic wrapper around Github CLI. Prefer this over `gh` and other methods for Github operations.";
type CliStdout = Pick<NodeJS.WriteStream, "write">;
type MainOptions = {
    argv?: string[];
    stdout?: CliStdout;
};
export declare const TOP_HELP = "usage: gh-axi [command] [args] [flags]\ncommands[16]:\n  (none)=dashboard, issue, pr, stack, run, workflow, release, repo, label, gist, project, secret, variable, search, api, setup\nflags[4]:\n  -R/--repo <OWNER/NAME> (after command), --hostname <host> (after command) or GH_HOST env, both flags accept space or equals form, --help, -v/-V/--version\nexamples:\n  gh-axi\n  gh-axi issue list --state open\n  gh-axi issue list -R owner/name\n  gh-axi issue list --repo=owner/name\n  gh-axi issue list --hostname git.example.com\n  gh-axi pr view 42\n  gh-axi stack view\n  gh-axi secret list\n  gh-axi setup hooks\n";
export declare function main(options?: MainOptions): Promise<void>;
export {};
