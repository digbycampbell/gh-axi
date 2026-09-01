import { encode } from "@toon-format/toon";
import { ghJson, ghExec } from "../gh.js";
import { AxiError } from "../errors.js";
import { getFlag, hasFlag, takeBoolFlag, takeFlag, rejectUnknownFlags, } from "../args.js";
import { takeBody, truncateBody } from "../body.js";
import { field, boolYesNo, relativeTime, pluck, custom, renderList, renderDetail, renderHelp, renderOutput, renderError, } from "../toon.js";
import { getSuggestions } from "../suggestions.js";
const RELEASE_FLAGS = {
    list: ["--limit", "--exclude-drafts", "--exclude-pre-releases"],
    view: ["--full"],
    create: [
        "--body",
        "--body-file",
        "--title",
        "-t",
        "--notes",
        "-n",
        "--notes-file",
        "-F",
        "--target",
        "--discussion-category",
        "--notes-start-tag",
        "--draft",
        "-d",
        "--prerelease",
        "-p",
        "--generate-notes",
        "--verify-tag",
        "--notes-from-tag",
        "--fail-on-no-commits",
        "--latest",
    ],
    edit: [
        "--body",
        "--body-file",
        "--title",
        "--notes",
        "-n",
        "--notes-file",
        "-F",
        "--draft",
        "--prerelease",
        "--latest",
    ],
    delete: [],
    download: ["--pattern", "--dir"],
    upload: [],
};
export const RELEASE_HELP = `usage: gh-axi release <subcommand> [flags]
subcommands[7]:
  list, view <tag>, create <tag>, edit <tag>, delete <tag>, download <tag>, upload <tag>
flags{list}:
  --exclude-drafts, --exclude-pre-releases, --limit (default 10)
flags{view}:
  --full (show complete release notes without truncation)
flags{create}:
  --title/-t, --notes/-n or --body, --notes-file/-F or --body-file, --draft/-d, --prerelease/-p, --target, --generate-notes, --discussion-category, --notes-start-tag, --verify-tag, --notes-from-tag, --fail-on-no-commits, --latest[=true|false], <files...>
flags{edit}:
  --title, --notes/-n or --body, --notes-file/-F or --body-file, --draft[=true|false], --prerelease[=true|false], --latest[=true|false]
flags{download}:
  --pattern, --dir
examples:
  gh-axi release list --exclude-drafts
  gh-axi release view v1.2.0 --full
  gh-axi release create v1.3.0 --body-file notes.md --draft dist/app.zip
  gh-axi release edit v1.3.0 --prerelease=false --latest`;
const listSchema = [
    field("tagName", "tag"),
    field("name"),
    boolYesNo("isDraft", "draft"),
    boolYesNo("isPrerelease", "prerelease"),
    relativeTime("publishedAt", "published"),
];
const viewSchema = [
    field("tagName", "tag"),
    field("name"),
    relativeTime("publishedAt", "published"),
    pluck("author", "login", "author"),
    custom("body", (item) => truncateBody(item.body, 1000)),
];
const viewSchemaFull = [
    field("tagName", "tag"),
    field("name"),
    relativeTime("publishedAt", "published"),
    pluck("author", "login", "author"),
    custom("body", (item) => (typeof item.body === "string" ? item.body : "")),
];
function takeFirstFlag(args, flags) {
    for (const flag of flags) {
        const value = takeFlag(args, flag);
        if (value !== undefined)
            return value;
    }
    return undefined;
}
function appendValueFlag(ghArgs, args, outputFlag, inputFlags = [outputFlag]) {
    const value = takeFirstFlag(args, inputFlags);
    if (value !== undefined)
        ghArgs.push(outputFlag, value);
}
function appendBoolFlag(ghArgs, args, outputFlag, inputFlags = [outputFlag]) {
    if (inputFlags.some((flag) => takeBoolFlag(args, flag))) {
        ghArgs.push(outputFlag);
    }
}
function appendOptionalValueBoolFlag(ghArgs, args, outputFlag, inputFlags = [outputFlag]) {
    const occurrences = args.flatMap((arg, index) => inputFlags.some((flag) => arg === flag || arg.startsWith(`${flag}=`))
        ? [index]
        : []);
    if (occurrences.length > 1) {
        throw new AxiError(`${outputFlag} may only be specified once`, "VALIDATION_ERROR");
    }
    if (occurrences.length === 0)
        return;
    const index = occurrences[0];
    const arg = args[index];
    const inputFlag = inputFlags.find((flag) => arg === flag || arg.startsWith(`${flag}=`));
    ghArgs.push(arg === inputFlag
        ? outputFlag
        : `${outputFlag}=${arg.slice(inputFlag.length + 1)}`);
    args.splice(index, 1);
}
function findProvidedFlags(args, flags) {
    return flags.filter((flag) => args.some((arg) => arg === flag || arg.startsWith(`${flag}=`)));
}
const RELEASE_NOTES_FLAGS = ["--notes", "-n", "--notes-file", "-F"];
function takeReleaseBodyAlias(args) {
    return takeBody(args, {
        label: "release notes",
        valueBoundaryFlags: RELEASE_NOTES_FLAGS,
    });
}
function assertNoReleaseNotesConflict(body, args, flags) {
    if (body === undefined)
        return;
    const conflicts = findProvidedFlags(args, flags);
    if (conflicts.length === 0)
        return;
    throw new AxiError(`Use only one release notes source: --body/--body-file cannot be combined with ${conflicts.join(", ")}`, "VALIDATION_ERROR", [
        "Use --body-file <path> for file-backed release notes, or remove --body-file and use --notes-file <path>",
    ]);
}
async function listReleases(args, ctx) {
    const limit = getFlag(args, "--limit") ?? "10";
    const ghArgs = [
        "release",
        "list",
        "--json",
        "tagName,name,isDraft,isPrerelease,publishedAt",
        "--limit",
        limit,
    ];
    if (hasFlag(args, "--exclude-drafts"))
        ghArgs.push("--exclude-drafts");
    if (hasFlag(args, "--exclude-pre-releases"))
        ghArgs.push("--exclude-pre-releases");
    const releases = await ghJson(ghArgs, ctx);
    const isEmpty = releases.length === 0;
    const limitNum = Number(limit);
    const countLine = releases.length === limitNum
        ? `count: ${releases.length} (showing first ${releases.length}; run \`gh-axi repo view\` for total count)`
        : `count: ${releases.length}`;
    const suggestions = getSuggestions({
        domain: "release",
        action: "list",
        isEmpty,
        repo: ctx,
    });
    return renderOutput([
        countLine,
        renderList("releases", releases, listSchema),
        renderHelp(suggestions),
    ]);
}
async function viewRelease(args, ctx) {
    const full = hasFlag(args, "--full");
    const positionals = args.filter((a) => !a.startsWith("--"));
    const tag = positionals[1];
    if (!tag)
        throw new AxiError("Tag is required: gh-axi release view <tag>", "VALIDATION_ERROR");
    const release = await ghJson(["release", "view", tag, "--json", "tagName,name,publishedAt,author,body"], ctx);
    return renderOutput([
        renderDetail("release", release, full ? viewSchemaFull : viewSchema),
    ]);
}
async function createRelease(args, ctx) {
    const remaining = args.slice(1);
    const optionArgs = [];
    const body = takeReleaseBodyAlias(remaining);
    assertNoReleaseNotesConflict(body, remaining, RELEASE_NOTES_FLAGS);
    if (body !== undefined)
        optionArgs.push("--notes", body);
    appendValueFlag(optionArgs, remaining, "--title", ["--title", "-t"]);
    appendValueFlag(optionArgs, remaining, "--notes", ["--notes", "-n"]);
    appendValueFlag(optionArgs, remaining, "--notes-file", [
        "--notes-file",
        "-F",
    ]);
    appendValueFlag(optionArgs, remaining, "--target");
    appendValueFlag(optionArgs, remaining, "--discussion-category");
    appendValueFlag(optionArgs, remaining, "--notes-start-tag");
    appendBoolFlag(optionArgs, remaining, "--draft", ["--draft", "-d"]);
    appendBoolFlag(optionArgs, remaining, "--prerelease", ["--prerelease", "-p"]);
    appendBoolFlag(optionArgs, remaining, "--generate-notes");
    appendBoolFlag(optionArgs, remaining, "--verify-tag");
    appendBoolFlag(optionArgs, remaining, "--notes-from-tag");
    appendBoolFlag(optionArgs, remaining, "--fail-on-no-commits");
    appendOptionalValueBoolFlag(optionArgs, remaining, "--latest");
    const positionals = remaining.filter((a) => !a.startsWith("-"));
    const tag = positionals[0];
    if (!tag)
        throw new AxiError("Tag is required: gh-axi release create <tag>", "VALIDATION_ERROR");
    const ghArgs = [
        "release",
        "create",
        tag,
        ...optionArgs,
        ...positionals.slice(1),
    ];
    await ghExec(ghArgs, ctx);
    const suggestions = getSuggestions({
        domain: "release",
        action: "create",
        id: tag,
        repo: ctx,
    });
    return renderOutput([
        encode({ created: "ok", tag }),
        renderHelp(suggestions),
    ]);
}
async function editRelease(args, ctx) {
    const remaining = [...args];
    const body = takeReleaseBodyAlias(remaining);
    assertNoReleaseNotesConflict(body, remaining, RELEASE_NOTES_FLAGS);
    const optionArgs = [];
    appendValueFlag(optionArgs, remaining, "--title");
    if (body !== undefined)
        optionArgs.push("--notes", body);
    appendValueFlag(optionArgs, remaining, "--notes", ["--notes", "-n"]);
    appendValueFlag(optionArgs, remaining, "--notes-file", [
        "--notes-file",
        "-F",
    ]);
    // gh accepts --flag=false to unset these; takeBoolFlag would drop that form
    // and the edit would silently no-op (prints the tag, changes nothing).
    appendOptionalValueBoolFlag(optionArgs, remaining, "--draft");
    appendOptionalValueBoolFlag(optionArgs, remaining, "--prerelease");
    appendOptionalValueBoolFlag(optionArgs, remaining, "--latest");
    const positionals = remaining.filter((a) => !a.startsWith("-"));
    const tag = positionals[1];
    if (!tag)
        throw new AxiError("Tag is required: gh-axi release edit <tag>", "VALIDATION_ERROR");
    const ghArgs = ["release", "edit", tag, ...optionArgs];
    await ghExec(ghArgs, ctx);
    const suggestions = getSuggestions({
        domain: "release",
        action: "edit",
        id: tag,
        repo: ctx,
    });
    return renderOutput([encode({ edit: "ok", tag }), renderHelp(suggestions)]);
}
async function deleteRelease(args, ctx) {
    const positionals = args.filter((a) => !a.startsWith("--"));
    const tag = positionals[1];
    if (!tag)
        throw new AxiError("Tag is required: gh-axi release delete <tag>", "VALIDATION_ERROR");
    // Idempotent: check if release exists before deleting
    try {
        await ghJson(["release", "view", tag, "--json", "tagName"], ctx);
    }
    catch (err) {
        if (err instanceof AxiError && err.code === "NOT_FOUND") {
            const suggestions = getSuggestions({
                domain: "release",
                action: "delete",
                id: tag,
                repo: ctx,
            });
            return renderOutput([
                encode({ delete: "already_deleted", tag }),
                renderHelp(suggestions),
            ]);
        }
        throw err;
    }
    await ghExec(["release", "delete", tag, "--yes"], ctx);
    const suggestions = getSuggestions({
        domain: "release",
        action: "delete",
        id: tag,
        repo: ctx,
    });
    return renderOutput([encode({ delete: "ok", tag }), renderHelp(suggestions)]);
}
async function downloadRelease(args, ctx) {
    const positionals = args.filter((a) => !a.startsWith("--"));
    const tag = positionals[1];
    if (!tag)
        throw new AxiError("Tag is required: gh-axi release download <tag>", "VALIDATION_ERROR");
    const ghArgs = ["release", "download", tag];
    const pattern = getFlag(args, "--pattern");
    if (pattern)
        ghArgs.push("--pattern", pattern);
    const dir = getFlag(args, "--dir");
    if (dir)
        ghArgs.push("--dir", dir);
    await ghExec(ghArgs, ctx);
    const suggestions = getSuggestions({
        domain: "release",
        action: "download",
        id: tag,
        repo: ctx,
    });
    return renderOutput([
        encode({ download: "ok", tag }),
        renderHelp(suggestions),
    ]);
}
async function uploadRelease(args, ctx) {
    const positionals = args.filter((a) => !a.startsWith("--"));
    const tag = positionals[1];
    if (!tag)
        throw new AxiError("Tag is required: gh-axi release upload <tag> <files...>", "VALIDATION_ERROR");
    const files = positionals.slice(2);
    if (files.length === 0)
        throw new AxiError("At least one file is required: gh-axi release upload <tag> <files...>", "VALIDATION_ERROR");
    await ghExec(["release", "upload", tag, ...files], ctx);
    const suggestions = getSuggestions({
        domain: "release",
        action: "upload",
        id: tag,
        repo: ctx,
    });
    return renderOutput([
        encode({ upload: "ok", tag, files: files.length }),
        renderHelp(suggestions),
    ]);
}
export async function releaseCommand(args, ctx) {
    const sub = args[0];
    if (sub === "--help" || sub === undefined)
        return RELEASE_HELP;
    switch (sub) {
        case "list":
            rejectUnknownFlags(args.slice(1), RELEASE_FLAGS.list, "release", "list");
            return listReleases(args, ctx);
        case "view":
            rejectUnknownFlags(args.slice(1), RELEASE_FLAGS.view, "release", "view");
            return viewRelease(args, ctx);
        case "create":
            rejectUnknownFlags(args.slice(1), RELEASE_FLAGS.create, "release", "create");
            return createRelease(args, ctx);
        case "edit":
            rejectUnknownFlags(args.slice(1), RELEASE_FLAGS.edit, "release", "edit");
            return editRelease(args, ctx);
        case "delete":
            rejectUnknownFlags(args.slice(1), RELEASE_FLAGS.delete, "release", "delete");
            return deleteRelease(args, ctx);
        case "download":
            rejectUnknownFlags(args.slice(1), RELEASE_FLAGS.download, "release", "download");
            return downloadRelease(args, ctx);
        case "upload":
            rejectUnknownFlags(args.slice(1), RELEASE_FLAGS.upload, "release", "upload");
            return uploadRelease(args, ctx);
        default:
            return renderError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
                "Available subcommands: list, view, create, edit, delete, download, upload",
            ]);
    }
}
//# sourceMappingURL=release.js.map