import { encode } from "@toon-format/toon";
import { ghJson, ghExec, ghRaw } from "../gh.js";
import { AxiError } from "../errors.js";
import { takeBody, truncateBody } from "../body.js";
import { formatCountLine } from "../format.js";
import { fetchListTotal } from "../totals.js";
import { getSuggestions } from "../suggestions.js";
import { takeFlag, takeBoolFlag, takeNumber, takeAllFlags, pushRepeated, rejectUnknownFlags, } from "../args.js";
import { parseFields } from "../fields.js";
import { field, pluck, lower, boolYesNo, mapEnum, relativeTime, joinArray, custom, renderList, renderDetail, renderHelp, renderError, renderOutput, } from "../toon.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Classify a status check into a simple status category. */
function classifyCheck(c) {
    const conc = (c.conclusion ?? "").toUpperCase();
    if (conc === "SUCCESS" || conc === "NEUTRAL")
        return "pass";
    if (conc === "FAILURE" ||
        conc === "TIMED_OUT" ||
        conc === "ACTION_REQUIRED" ||
        conc === "STARTUP_FAILURE" ||
        conc === "STALE" ||
        conc === "CANCELLED")
        return "fail";
    if (conc === "SKIPPED")
        return "skip";
    if (conc)
        return "pending";
    // No conclusion: either a StatusContext, whose verdict lives in `state`, or a
    // CheckRun that has not finished yet — a CheckRun's `status` (QUEUED /
    // IN_PROGRESS / COMPLETED) never carries a verdict, so it stays pending.
    const state = (c.state ?? "").toUpperCase();
    if (state === "SUCCESS")
        return "pass";
    if (state === "FAILURE" || state === "ERROR")
        return "fail";
    if (state === "EXPECTED" || state === "NEUTRAL")
        return "skip";
    return "pending";
}
function prRestPath(ctx, num, suffix) {
    const repoPath = ctx
        ? `repos/${ctx.owner}/${ctx.name}`
        : "repos/{owner}/{repo}";
    return `${repoPath}/pulls/${num}/${suffix}`;
}
/**
 * True when the given base branch is guarded by a `merge_queue` ruleset.
 *
 * On such a branch a plain `gh pr merge` enqueues the PR but still exits 0, so
 * gh-axi has to enqueue explicitly (`--auto`) and verify the real outcome
 * rather than trust the exit code. Detection reads the branch's active rules
 * via the REST API; the path carries an explicit `owner/repo` (never a `--repo`
 * flag, which `gh api` rejects), mirroring `ghApiPaginatedArray`. Any failure
 * to read rules (denied visibility, older GHE) falls back to the non-queue
 * path so default-branch behaviour is unchanged.
 */
async function baseInMergeQueue(ctx, branch) {
    if (!branch)
        return false;
    const repoPath = ctx
        ? `repos/${ctx.owner}/${ctx.name}`
        : "repos/{owner}/{repo}";
    try {
        const rules = await ghJson([
            "api",
            `${repoPath}/rules/branches/${encodeURIComponent(branch)}`,
        ]);
        return Array.isArray(rules) && rules.some((r) => r?.type === "merge_queue");
    }
    catch {
        return false;
    }
}
function flattenPaginated(items) {
    if (items.length > 0 && Array.isArray(items[0]))
        return items.flat();
    return items;
}
async function ghApiPaginatedArray(path) {
    const pages = await ghJson([
        "api",
        path,
        "--paginate",
        "--slurp",
    ]);
    return flattenPaginated(pages);
}
// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const REVIEW_MAP = {
    APPROVED: "approved",
    CHANGES_REQUESTED: "changes_requested",
    REVIEW_REQUIRED: "required",
};
const REVIEW_STATE_MAP = {
    APPROVED: "approved",
    CHANGES_REQUESTED: "changes_requested",
    COMMENTED: "commented",
    DISMISSED: "dismissed",
    PENDING: "pending",
};
const listSchema = [
    field("number"),
    field("title"),
    lower("state"),
    pluck("author", "login", "author"),
    boolYesNo("isDraft", "draft"),
    mapEnum("reviewDecision", REVIEW_MAP, "none", "review"),
];
const LIST_JSON_FIELDS = "number,title,state,author,isDraft,reviewDecision";
const PR_LIST_EXTRA_FIELDS = {
    body: { jsonKey: "body", def: field("body") },
    createdAt: {
        jsonKey: "createdAt",
        def: relativeTime("createdAt", "created"),
    },
    labels: { jsonKey: "labels", def: joinArray("labels", "name", "labels") },
    milestone: {
        jsonKey: "milestone",
        def: pluck("milestone", "title", "milestone"),
    },
    mergedAt: { jsonKey: "mergedAt", def: relativeTime("mergedAt", "merged_at") },
    url: { jsonKey: "url", def: field("url") },
};
const viewSchema = [
    field("number"),
    field("title"),
    lower("state"),
    pluck("author", "login", "author"),
    boolYesNo("isDraft", "draft"),
    custom("merged", (item) => {
        if ((item.state ?? "").toUpperCase() === "MERGED")
            return item.mergedAt ?? "yes";
        return "no";
    }),
    custom("checks", (item) => {
        const checks = item.statusCheckRollup;
        if (!Array.isArray(checks) || checks.length === 0)
            return "0 passed, 0 failed — this PR has no CI checks configured";
        const passed = checks.filter((c) => classifyCheck(c) === "pass").length;
        const failed = checks.filter((c) => classifyCheck(c) === "fail").length;
        const skipped = checks.filter((c) => classifyCheck(c) === "skip").length;
        const parts = [`${passed} passed`, `${failed} failed`];
        if (skipped > 0)
            parts.push(`${skipped} skipped`);
        parts.push(`${checks.length} total`);
        return parts.join(", ");
    }),
    custom("body", (item) => truncateBody(item.body, 500)),
];
const viewSchemaFull = viewSchema.map((f) => "as" in f && f.as === "body"
    ? custom("body", (item) => typeof item.body === "string" ? item.body : "")
    : f);
const VIEW_JSON_FIELDS = "number,title,state,author,isDraft,mergedAt,statusCheckRollup,body,comments,reviews";
// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------
// --search is intentionally listed: prList rejects it with a dedicated hint
// pointing at `gh-axi search`, so rejectUnknownFlags lets it through to that
// handler instead of shadowing the targeted error.
const PR_FLAGS = {
    list: [
        "--fields",
        "--state",
        "--label",
        "--assignee",
        "--author",
        "--base",
        "--head",
        "--draft",
        "--limit",
        "--search",
    ],
    view: ["--comments", "--reviews", "--full"],
    create: [
        "--title",
        "--body",
        "--body-file",
        "--base",
        "--head",
        "--draft",
        "--assignee",
        "--reviewer",
        "--label",
        "--milestone",
        "--project",
    ],
    edit: [
        "--title",
        "--body",
        "--body-file",
        "--add-label",
        "--remove-label",
        "--add-assignee",
        "--remove-assignee",
        "--add-reviewer",
        "--remove-reviewer",
        "--milestone",
        "--base",
    ],
    close: ["--comment"],
    merge: [
        "--method",
        "--merge",
        "--squash",
        "--rebase",
        "--auto",
        "--delete-branch",
        "--body",
        "--body-file",
        "--subject",
    ],
    review: [
        "--approve",
        "--request-changes",
        "--comment",
        "--body",
        "--body-file",
    ],
    checks: [],
    diff: ["--full"],
    checkout: [],
    ready: [],
    reopen: [],
    comment: ["--body", "--body-file"],
    "update-branch": [],
    revert: [],
};
export const PR_HELP = `usage: gh-axi pr <subcommand> [flags]
subcommands[15]:
  list, view <number>, create, edit <number>, close <number>, merge <number>, review <number>, checks <number>, diff <number>, checkout <number>, ready <number>, reopen <number>, comment <number>, update-branch <number>, revert <number>
flags{list}:
  --state <open|closed|all>, --label (repeatable), --assignee, --author, --base, --head, --draft, --limit <n> (default 30), --fields <a,b,c>
flags{view}:
  --comments, --reviews (show review submissions and inline review comments), --full (show complete body without truncation)
flags{create}:
  --title <text> (required), --body <text> or --body-file <path>, --base, --head, --draft, --assignee <login> (repeatable), --reviewer <login> (repeatable), --label <name> (repeatable), --milestone, --project <name> (repeatable)
flags{edit}:
  --title <text>, --body <text> or --body-file <path>, --add-label <name> (repeatable), --remove-label <name> (repeatable), --add-assignee <login> (repeatable), --remove-assignee <login> (repeatable), --add-reviewer <login> (repeatable), --remove-reviewer <login> (repeatable), --milestone
flags{merge}:
  --method <merge|squash|rebase>, --merge, --squash, --rebase, --auto, --delete-branch, --body <text> or --body-file <path>, --subject (a base branch with a merge queue auto-enqueues; status is merged or enqueued)
flags{review}:
  --approve, --request-changes, --comment, --body <text> or --body-file <path>
flags{comment}:
  --body <text> or --body-file <path> (required)
flags{checks}:
  (none)
flags{diff}:
  --full (show complete diff without truncation)
examples:
  gh-axi pr list --state open --label bug
  gh-axi pr view 42 --comments
  gh-axi pr view 42 --reviews
  gh-axi pr comment 42 --body-file review.md
  gh-axi pr merge 42 --squash --delete-branch`;
// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------
async function prList(args, ctx) {
    if (args.includes("--search")) {
        throw new AxiError('pr list does not support --search. Use `gh-axi search prs "<query>"` instead for full-text search with total counts.', "VALIDATION_ERROR");
    }
    const fieldsArg = takeFlag(args, "--fields");
    const { extraDefs, extraJsonKeys } = parseFields(fieldsArg, PR_LIST_EXTRA_FIELDS);
    const state = takeFlag(args, "--state") ?? "open";
    const labels = takeAllFlags(args, "--label");
    const assignee = takeFlag(args, "--assignee");
    const author = takeFlag(args, "--author");
    const base = takeFlag(args, "--base");
    const head = takeFlag(args, "--head");
    const draft = takeBoolFlag(args, "--draft");
    const limit = takeFlag(args, "--limit") ?? "30";
    const jsonFields = extraJsonKeys.length > 0
        ? LIST_JSON_FIELDS + "," + extraJsonKeys.join(",")
        : LIST_JSON_FIELDS;
    const ghArgs = [
        "pr",
        "list",
        "--json",
        jsonFields,
        "--state",
        state,
        "--limit",
        limit,
    ];
    pushRepeated(ghArgs, "--label", labels);
    if (assignee)
        ghArgs.push("--assignee", assignee);
    if (author)
        ghArgs.push("--author", author);
    if (base)
        ghArgs.push("--base", base);
    if (head)
        ghArgs.push("--head", head);
    if (draft)
        ghArgs.push("--draft");
    const items = await ghJson(ghArgs, ctx);
    const isEmpty = items.length === 0;
    const limitNum = Number(limit);
    // Only a page truncated by the limit needs a total; a short page already
    // shows every match.
    let totalCount;
    if (items.length === limitNum && ctx) {
        const filters = [];
        for (const label of labels)
            filters.push({ key: "label", value: label, list: true });
        if (assignee)
            filters.push({ key: "assignee", value: assignee });
        if (author)
            filters.push({ key: "author", value: author });
        if (base)
            filters.push({ key: "base", value: base });
        if (head)
            filters.push({ key: "head", value: head });
        if (draft)
            filters.push({ key: "draft", value: "true" });
        totalCount = await fetchListTotal(ctx, "pullRequests", state, filters);
    }
    const countLine = formatCountLine({
        count: items.length,
        limit: limitNum,
        totalCount,
    });
    const extendedSchema = extraDefs.length > 0 ? [...listSchema, ...extraDefs] : listSchema;
    return renderOutput([
        countLine,
        renderList("pull_requests", items, extendedSchema),
        renderHelp(getSuggestions({ domain: "pr", action: "list", isEmpty, repo: ctx })),
    ]);
}
async function prView(args, ctx) {
    const includeComments = takeBoolFlag(args, "--comments");
    const includeReviews = takeBoolFlag(args, "--reviews");
    const full = takeBoolFlag(args, "--full");
    const num = takeNumber(args, "PR");
    // Always fetch comments + review summaries (for count or full rendering)
    const ghArgs = ["pr", "view", String(num), "--json", VIEW_JSON_FIELDS];
    const pr = await ghJson(ghArgs, ctx);
    const schema = [...(full ? viewSchemaFull : viewSchema)];
    if (includeComments && Array.isArray(pr.comments)) {
        schema.push(custom("comments", (item) => (item.comments ?? []).map((c) => ({
            author: c.author?.login ?? "unknown",
            body: c.body ?? "",
            created: c.createdAt ?? "",
        }))));
    }
    else {
        const commentCount = Array.isArray(pr.comments) ? pr.comments.length : 0;
        schema.push(custom("comment_count", () => `${commentCount} — use --comments to see full comments`));
    }
    if (includeReviews) {
        // gh pr view --json reviews returns GraphQL node IDs, which don't match
        // the numeric review IDs on inline review comments. Fetch both via REST
        // so we can correlate inline comments back to their parent review.
        const reviews = await ghApiPaginatedArray(prRestPath(ctx, num, "reviews"));
        let inlineComments = [];
        if (reviews.length > 0) {
            inlineComments = await ghApiPaginatedArray(prRestPath(ctx, num, "comments"));
        }
        const commentsByReview = new Map();
        for (const c of inlineComments) {
            if (typeof c.pull_request_review_id === "number") {
                const list = commentsByReview.get(c.pull_request_review_id) ?? [];
                list.push(c);
                commentsByReview.set(c.pull_request_review_id, list);
            }
        }
        schema.push(custom("reviews", () => reviews.map((r) => {
            const stateUpper = (r.state ?? "").toUpperCase();
            const inline = commentsByReview.get(r.id) ?? [];
            return {
                author: r.user?.login ?? "unknown",
                state: REVIEW_STATE_MAP[stateUpper] ??
                    stateUpper.toLowerCase() ??
                    "unknown",
                submitted: r.submitted_at ?? "",
                body: r.body ?? "",
                inline_comments: inline.map((c) => ({
                    author: c.user?.login ?? "unknown",
                    path: c.path ?? "",
                    line: c.line ?? c.original_line ?? null,
                    body: c.body ?? "",
                    created: c.created_at ?? "",
                })),
            };
        })));
    }
    else {
        const reviewCount = Array.isArray(pr.reviews) ? pr.reviews.length : 0;
        schema.push(custom("review_count", () => `${reviewCount} — use --reviews to see full reviews`));
    }
    return renderOutput([renderDetail("pull_request", pr, schema)]);
}
async function prCreate(args, ctx) {
    const title = takeFlag(args, "--title");
    if (!title)
        throw new AxiError("--title is required", "VALIDATION_ERROR");
    const body = takeBody(args);
    const base = takeFlag(args, "--base");
    const head = takeFlag(args, "--head");
    const draft = takeBoolFlag(args, "--draft");
    const assignees = takeAllFlags(args, "--assignee");
    const reviewers = takeAllFlags(args, "--reviewer");
    const labels = takeAllFlags(args, "--label");
    const milestone = takeFlag(args, "--milestone");
    const projects = takeAllFlags(args, "--project");
    const ghArgs = ["pr", "create", "--title", title];
    if (body !== undefined)
        ghArgs.push("--body", body);
    if (base)
        ghArgs.push("--base", base);
    if (head)
        ghArgs.push("--head", head);
    if (draft)
        ghArgs.push("--draft");
    pushRepeated(ghArgs, "--assignee", assignees);
    pushRepeated(ghArgs, "--reviewer", reviewers);
    pushRepeated(ghArgs, "--label", labels);
    if (milestone)
        ghArgs.push("--milestone", milestone);
    pushRepeated(ghArgs, "--project", projects);
    const stdout = await ghExec(ghArgs, ctx);
    // Parse PR number from the emitted URL: https://<host>/OWNER/REPO/pull/123
    const urlMatch = stdout.match(/\/pull\/(\d+)/);
    const num = urlMatch ? Number(urlMatch[1]) : undefined;
    const url = stdout.trim().split("\n").pop()?.trim() ?? "";
    return renderOutput([
        renderDetail("created", { number: num ?? url, url }, [
            field("number"),
            field("url"),
        ]),
        renderHelp(getSuggestions({ domain: "pr", action: "create", id: num, repo: ctx })),
    ]);
}
async function prEdit(args, ctx) {
    const num = takeNumber(args, "PR");
    const title = takeFlag(args, "--title");
    const body = takeBody(args);
    const addLabels = takeAllFlags(args, "--add-label");
    const removeLabels = takeAllFlags(args, "--remove-label");
    const addAssignees = takeAllFlags(args, "--add-assignee");
    const removeAssignees = takeAllFlags(args, "--remove-assignee");
    const addReviewers = takeAllFlags(args, "--add-reviewer");
    const removeReviewers = takeAllFlags(args, "--remove-reviewer");
    const milestone = takeFlag(args, "--milestone");
    const base = takeFlag(args, "--base");
    const ghArgs = ["pr", "edit", String(num)];
    if (title)
        ghArgs.push("--title", title);
    if (body !== undefined)
        ghArgs.push("--body", body);
    pushRepeated(ghArgs, "--add-label", addLabels);
    pushRepeated(ghArgs, "--remove-label", removeLabels);
    pushRepeated(ghArgs, "--add-assignee", addAssignees);
    pushRepeated(ghArgs, "--remove-assignee", removeAssignees);
    pushRepeated(ghArgs, "--add-reviewer", addReviewers);
    pushRepeated(ghArgs, "--remove-reviewer", removeReviewers);
    if (milestone)
        ghArgs.push("--milestone", milestone);
    if (base)
        ghArgs.push("--base", base);
    await ghExec(ghArgs, ctx);
    return renderOutput([
        renderDetail("edited", { number: num, status: "ok" }, [
            field("number"),
            field("status"),
        ]),
        renderHelp(getSuggestions({ domain: "pr", action: "edit", id: num, repo: ctx })),
    ]);
}
async function prClose(args, ctx) {
    const comment = takeFlag(args, "--comment");
    const num = takeNumber(args, "PR");
    // Idempotent: check current state
    const pr = await ghJson(["pr", "view", String(num), "--json", "state"], ctx);
    const state = (pr.state ?? "").toUpperCase();
    if (state === "CLOSED" || state === "MERGED") {
        return renderOutput([
            renderDetail("pull_request", { number: num, state: state.toLowerCase(), already: true }, [field("number"), field("state"), field("already")]),
            renderHelp(getSuggestions({ domain: "pr", action: "close", id: num, repo: ctx })),
        ]);
    }
    const ghArgs = ["pr", "close", String(num)];
    if (comment)
        ghArgs.push("--comment", comment);
    await ghExec(ghArgs, ctx);
    return renderOutput([
        renderDetail("closed", { number: num, status: "ok" }, [
            field("number"),
            field("status"),
        ]),
        renderHelp(getSuggestions({ domain: "pr", action: "close", id: num, repo: ctx })),
    ]);
}
async function prMerge(args, ctx) {
    const num = takeNumber(args, "PR");
    const explicitMethod = takeFlag(args, "--method");
    const shorthandMethods = ["merge", "squash", "rebase"].filter((candidate) => takeBoolFlag(args, `--${candidate}`));
    if (shorthandMethods.length > 1) {
        throw new AxiError("Choose only one merge method: --merge, --squash, or --rebase", "VALIDATION_ERROR");
    }
    if (explicitMethod &&
        shorthandMethods.length === 1 &&
        explicitMethod !== shorthandMethods[0]) {
        throw new AxiError("Choose either --method or a matching merge method shorthand, not both", "VALIDATION_ERROR");
    }
    const method = explicitMethod ?? shorthandMethods[0];
    if (method && !["merge", "squash", "rebase"].includes(method)) {
        throw new AxiError("--method must be one of: merge, squash, rebase", "VALIDATION_ERROR");
    }
    const auto = takeBoolFlag(args, "--auto");
    const deleteBranch = takeBoolFlag(args, "--delete-branch");
    const body = takeBody(args);
    const subject = takeFlag(args, "--subject");
    // Idempotent: check if already merged
    const pr = await ghJson([
        "pr",
        "view",
        String(num),
        "--json",
        "state,mergedBy,mergedAt,baseRefName",
    ], ctx);
    if ((pr.state ?? "").toUpperCase() === "MERGED") {
        return renderOutput([
            renderDetail("pull_request", {
                number: num,
                state: "merged",
                merged_by: pr.mergedBy?.login ?? null,
                merged_at: pr.mergedAt ?? null,
            }, [
                field("number"),
                field("state"),
                field("merged_by"),
                field("merged_at"),
            ]),
            renderHelp(getSuggestions({ domain: "pr", action: "merge", id: num, repo: ctx })),
        ]);
    }
    // A base branch guarded by a merge_queue ruleset does not merge on demand: a
    // plain `gh pr merge` enqueues the PR and still exits 0, so the old
    // `status: ok` was a phantom — it hid whether the PR merged, was merely
    // enqueued, or did neither. Detect the queue and, unless the caller already
    // opted into auto-merge, enqueue explicitly and report the true outcome.
    const enqueue = !auto && (await baseInMergeQueue(ctx, pr.baseRefName));
    const ghArgs = ["pr", "merge", String(num)];
    if (method)
        ghArgs.push("--" + method);
    if (auto || enqueue)
        ghArgs.push("--auto");
    if (deleteBranch)
        ghArgs.push("--delete-branch");
    if (body !== undefined)
        ghArgs.push("--body", body);
    if (subject)
        ghArgs.push("--subject", subject);
    await ghExec(ghArgs, ctx);
    if (enqueue)
        return renderMergeQueueOutcome(num, ctx);
    return renderOutput([
        renderDetail("merged", { number: num, status: "ok", method: method ?? "default" }, [field("number"), field("status"), field("method")]),
        renderHelp(getSuggestions({ domain: "pr", action: "merge", id: num, repo: ctx })),
    ]);
}
/**
 * After enqueuing onto a merge queue, re-read the PR and report the real
 * outcome: `merged` if it landed immediately, `enqueued` if auto-merge is now
 * enabled, or a loud non-zero failure if the merge call claimed success yet the
 * PR is neither — never a bare `status: ok` that would hide the distinction.
 */
async function renderMergeQueueOutcome(num, ctx) {
    const after = await ghJson([
        "pr",
        "view",
        String(num),
        "--json",
        "state,mergedBy,mergedAt,autoMergeRequest",
    ], ctx);
    const help = renderHelp(getSuggestions({ domain: "pr", action: "merge", id: num, repo: ctx }));
    if ((after.state ?? "").toUpperCase() === "MERGED") {
        return renderOutput([
            renderDetail("merged", {
                number: num,
                status: "merged",
                merged_by: after.mergedBy?.login ?? null,
                merged_at: after.mergedAt ?? null,
            }, [
                field("number"),
                field("status"),
                field("merged_by"),
                field("merged_at"),
            ]),
            help,
        ]);
    }
    if (after.autoMergeRequest) {
        return renderOutput([
            renderDetail("merged", {
                number: num,
                status: "enqueued",
                auto_merge: "enabled",
                enabled_by: after.autoMergeRequest.enabledBy?.login ?? null,
            }, [
                field("number"),
                field("status"),
                field("auto_merge"),
                field("enabled_by"),
            ]),
            help,
        ]);
    }
    throw new AxiError(`pr merge for #${num} reported success but the PR is neither merged nor ` +
        `enqueued (state=${(after.state ?? "unknown").toLowerCase()}); the merge ` +
        `queue did not accept it`, "UNKNOWN", getSuggestions({ domain: "pr", action: "merge", id: num, repo: ctx }));
}
async function prReview(args, ctx) {
    const num = takeNumber(args, "PR");
    const approve = takeBoolFlag(args, "--approve");
    const requestChanges = takeBoolFlag(args, "--request-changes");
    const commentFlag = takeBoolFlag(args, "--comment");
    const body = takeBody(args);
    const ghArgs = ["pr", "review", String(num)];
    if (approve)
        ghArgs.push("--approve");
    else if (requestChanges)
        ghArgs.push("--request-changes");
    else if (commentFlag)
        ghArgs.push("--comment");
    if (body !== undefined)
        ghArgs.push("--body", body);
    await ghExec(ghArgs, ctx);
    const action = approve
        ? "approved"
        : requestChanges
            ? "changes_requested"
            : "commented";
    return renderOutput([
        renderDetail("review", { number: num, action }, [
            field("number"),
            field("action"),
        ]),
        renderHelp(getSuggestions({ domain: "pr", action: "review", id: num, repo: ctx })),
    ]);
}
async function prChecks(args, ctx) {
    const num = takeNumber(args, "PR");
    // Use pr view --json statusCheckRollup instead of pr checks --json which
    // can error on PRs with unusual check data
    const pr = await ghJson(["pr", "view", String(num), "--json", "statusCheckRollup"], ctx);
    const checks = Array.isArray(pr.statusCheckRollup)
        ? pr.statusCheckRollup
        : [];
    if (checks.length === 0) {
        return renderOutput([
            encode({
                checks: "0 passed, 0 failed — this PR has no CI checks configured",
            }),
        ]);
    }
    // Pre-compute summary counts so agents don't have to count rows
    const passed = checks.filter((c) => classifyCheck(c) === "pass").length;
    const failed = checks.filter((c) => classifyCheck(c) === "fail").length;
    const skipped = checks.filter((c) => classifyCheck(c) === "skip").length;
    const pending = checks.length - passed - failed - skipped;
    const summaryParts = [`${passed} passed`, `${failed} failed`];
    if (skipped > 0)
        summaryParts.push(`${skipped} skipped`);
    if (pending > 0)
        summaryParts.push(`${pending} pending`);
    summaryParts.push(`${checks.length} total`);
    const checksSchema = [
        custom("name", (c) => c.name ?? c.context ?? "check"),
        custom("conclusion", (c) => classifyCheck(c)),
    ];
    return renderOutput([
        encode({ summary: summaryParts.join(", ") }),
        renderList("checks", checks, checksSchema),
        renderHelp(getSuggestions({ domain: "pr", action: "checks", id: num, repo: ctx })),
    ]);
}
const DIFF_TRUNCATE_LIMIT = 4000;
async function prDiff(args, ctx) {
    const full = takeBoolFlag(args, "--full");
    const num = takeNumber(args, "PR");
    const diff = await ghExec(["pr", "diff", String(num)], ctx);
    const shouldTruncate = !full && diff.length > DIFF_TRUNCATE_LIMIT;
    const prDiffBlock = {
        number: num,
        diff: shouldTruncate ? diff.slice(0, DIFF_TRUNCATE_LIMIT) : diff,
    };
    if (shouldTruncate) {
        prDiffBlock.truncated = true;
        prDiffBlock.original_length = diff.length;
    }
    const suggestions = getSuggestions({
        domain: "pr",
        action: "diff",
        id: num,
        repo: ctx,
    });
    if (shouldTruncate) {
        const repoArg = ctx && ctx.source !== "git" ? ` -R ${ctx.nwo}` : "";
        suggestions.unshift(`Run \`gh-axi${repoArg} pr diff ${num} --full\` to see the complete diff`);
    }
    return renderOutput([
        encode({ pr_diff: prDiffBlock }),
        renderHelp(suggestions),
    ]);
}
async function prCheckout(args, ctx) {
    const num = takeNumber(args, "PR");
    const stdout = await ghExec(["pr", "checkout", String(num)], ctx);
    // Extract branch name from output
    const branchMatch = stdout.match(/Switched to branch '([^']+)'/);
    const branch = branchMatch ? branchMatch[1] : stdout.trim();
    return renderOutput([
        renderDetail("checkout", { number: num, branch, status: "ok" }, [
            field("number"),
            field("branch"),
            field("status"),
        ]),
        renderHelp(getSuggestions({ domain: "pr", action: "checkout", id: num, repo: ctx })),
    ]);
}
async function prReady(args, ctx) {
    const num = takeNumber(args, "PR");
    // Idempotent: check if already not a draft
    const pr = await ghJson(["pr", "view", String(num), "--json", "isDraft"], ctx);
    if (!pr.isDraft) {
        return renderOutput([
            renderDetail("pull_request", { number: num, draft: "no", already: true }, [field("number"), field("draft"), field("already")]),
            renderHelp(getSuggestions({ domain: "pr", action: "ready", id: num, repo: ctx })),
        ]);
    }
    await ghExec(["pr", "ready", String(num)], ctx);
    return renderOutput([
        renderDetail("ready", { number: num, status: "ok" }, [
            field("number"),
            field("status"),
        ]),
        renderHelp(getSuggestions({ domain: "pr", action: "ready", id: num, repo: ctx })),
    ]);
}
async function prReopen(args, ctx) {
    const num = takeNumber(args, "PR");
    // Idempotent: check current state
    const pr = await ghJson(["pr", "view", String(num), "--json", "state"], ctx);
    const state = (pr.state ?? "").toUpperCase();
    if (state === "OPEN") {
        return renderOutput([
            renderDetail("pull_request", { number: num, state: "open", already: true }, [field("number"), field("state"), field("already")]),
            renderHelp(getSuggestions({ domain: "pr", action: "reopen", id: num, repo: ctx })),
        ]);
    }
    await ghExec(["pr", "reopen", String(num)], ctx);
    return renderOutput([
        renderDetail("reopened", { number: num, status: "ok" }, [
            field("number"),
            field("status"),
        ]),
        renderHelp(getSuggestions({ domain: "pr", action: "reopen", id: num, repo: ctx })),
    ]);
}
async function prComment(args, ctx) {
    const num = takeNumber(args, "PR");
    const body = takeBody(args, { required: true });
    await ghExec(["pr", "comment", String(num), "--body", body], ctx);
    return renderOutput([
        renderDetail("commented", { number: num, status: "ok" }, [
            field("number"),
            field("status"),
        ]),
        renderHelp(getSuggestions({ domain: "pr", action: "comment", id: num, repo: ctx })),
    ]);
}
async function prUpdateBranch(args, ctx) {
    const num = takeNumber(args, "PR");
    await ghExec(["pr", "update-branch", String(num)], ctx);
    return renderOutput([
        renderDetail("updated", { number: num, status: "ok" }, [
            field("number"),
            field("status"),
        ]),
        renderHelp(getSuggestions({
            domain: "pr",
            action: "update-branch",
            id: num,
            repo: ctx,
        })),
    ]);
}
async function prRevert(args, ctx) {
    const num = takeNumber(args, "PR");
    // gh pr revert may not exist in all gh versions; fall back to API
    const result = await ghRaw(["pr", "revert", String(num)], ctx);
    if (result.exitCode === 0) {
        // Try to extract the new PR number/URL from stdout
        const urlMatch = result.stdout.match(/\/pull\/(\d+)/);
        const newNum = urlMatch ? Number(urlMatch[1]) : null;
        return renderOutput([
            renderDetail("reverted", { number: num, revert_pr: newNum, status: "ok" }, [field("number"), field("revert_pr"), field("status")]),
            renderHelp(getSuggestions({
                domain: "pr",
                action: "revert",
                id: newNum ?? num,
                repo: ctx,
            })),
        ]);
    }
    // Fallback: use gh api to create a revert via the REST API
    const apiResult = await ghRaw(["api", `repos/{owner}/{repo}/pulls/${num}/revert`, "--method", "POST"], ctx);
    if (apiResult.exitCode !== 0) {
        throw new AxiError(apiResult.stderr.trim().split("\n")[0] || `Failed to revert PR #${num}`, "UNKNOWN");
    }
    let revertData;
    try {
        revertData = JSON.parse(apiResult.stdout);
    }
    catch {
        revertData = {};
    }
    return renderOutput([
        renderDetail("reverted", {
            number: num,
            revert_pr: revertData.number ?? null,
            url: revertData.html_url ?? null,
            status: "ok",
        }, [field("number"), field("revert_pr"), field("url"), field("status")]),
        renderHelp(getSuggestions({
            domain: "pr",
            action: "revert",
            id: revertData.number ?? num,
            repo: ctx,
        })),
    ]);
}
// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export async function prCommand(args, ctx) {
    const sub = args[0];
    const rest = args.slice(1);
    switch (sub) {
        case "list":
            rejectUnknownFlags(rest, PR_FLAGS.list, "pr", "list");
            return prList(rest, ctx);
        case "view":
            rejectUnknownFlags(rest, PR_FLAGS.view, "pr", "view");
            return prView(rest, ctx);
        case "create":
            rejectUnknownFlags(rest, PR_FLAGS.create, "pr", "create");
            return prCreate(rest, ctx);
        case "edit":
            rejectUnknownFlags(rest, PR_FLAGS.edit, "pr", "edit");
            return prEdit(rest, ctx);
        case "close":
            rejectUnknownFlags(rest, PR_FLAGS.close, "pr", "close");
            return prClose(rest, ctx);
        case "merge":
            rejectUnknownFlags(rest, PR_FLAGS.merge, "pr", "merge");
            return prMerge(rest, ctx);
        case "review":
            rejectUnknownFlags(rest, PR_FLAGS.review, "pr", "review");
            return prReview(rest, ctx);
        case "checks":
            rejectUnknownFlags(rest, PR_FLAGS.checks, "pr", "checks");
            return prChecks(rest, ctx);
        case "diff":
            rejectUnknownFlags(rest, PR_FLAGS.diff, "pr", "diff");
            return prDiff(rest, ctx);
        case "checkout":
            rejectUnknownFlags(rest, PR_FLAGS.checkout, "pr", "checkout");
            return prCheckout(rest, ctx);
        case "ready":
            rejectUnknownFlags(rest, PR_FLAGS.ready, "pr", "ready");
            return prReady(rest, ctx);
        case "reopen":
            rejectUnknownFlags(rest, PR_FLAGS.reopen, "pr", "reopen");
            return prReopen(rest, ctx);
        case "comment":
            rejectUnknownFlags(rest, PR_FLAGS.comment, "pr", "comment");
            return prComment(rest, ctx);
        case "update-branch":
            rejectUnknownFlags(rest, PR_FLAGS["update-branch"], "pr", "update-branch");
            return prUpdateBranch(rest, ctx);
        case "revert":
            rejectUnknownFlags(rest, PR_FLAGS.revert, "pr", "revert");
            return prRevert(rest, ctx);
        case "--help":
        case "-h":
        case "help":
        case undefined:
            return PR_HELP;
        default:
            return renderError(`Unknown pr subcommand: ${sub}`, "VALIDATION_ERROR", [
                "Run `gh-axi pr --help` to see available subcommands",
            ]);
    }
}
//# sourceMappingURL=pr.js.map