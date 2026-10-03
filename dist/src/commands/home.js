import { ghJson } from "../gh.js";
import { field, lower, pluck, mapEnum, renderList, renderHelp, renderOutput, } from "../toon.js";
import { getSuggestions } from "../suggestions.js";
import { encode } from "@toon-format/toon";
export const HOME_HELP = "";
const issueSchema = [
    field("number"),
    field("title"),
    lower("state"),
    pluck("author", "login", "author"),
];
const prSchema = [
    field("number"),
    field("title"),
    pluck("author", "login", "author"),
    mapEnum("reviewDecision", {
        APPROVED: "approved",
        CHANGES_REQUESTED: "changes_requested",
        REVIEW_REQUIRED: "required",
    }, "none", "review"),
];
export async function homeCommand(_args, ctx) {
    // Run queries in parallel
    const [issues, prs] = await Promise.all([
        ghJson(["issue", "list", "--json", "number,title,state,author", "--limit", "3"], ctx).catch(() => []),
        ghJson([
            "pr",
            "list",
            "--json",
            "number,title,author,reviewDecision",
            "--limit",
            "3",
        ], ctx).catch(() => []),
    ]);
    const blocks = [];
    if (ctx) {
        blocks.push(encode({ repo: ctx.nwo }));
    }
    blocks.push(issues.length
        ? renderList("issues", issues, issueSchema)
        : "issues: 0 open");
    blocks.push(prs.length ? renderList("prs", prs, prSchema) : "prs: 0 open");
    const hints = [];
    if (issues.length >= 3)
        hints.push("Run `gh-axi issue list` for full issue list");
    if (prs.length >= 3)
        hints.push("Run `gh-axi pr list` for full PR list");
    const suggestions = getSuggestions({
        domain: "home",
        action: "home",
        repo: ctx,
    });
    blocks.push(renderHelp([...hints, ...suggestions]));
    return renderOutput(blocks);
}
//# sourceMappingURL=home.js.map