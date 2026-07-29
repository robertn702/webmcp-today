import type { FlowNode, FlowStep } from "./flow-diagram";

/**
 * The two ways a package actually reaches an agent. Both sequences are taken
 * from ARCHITECTURE.md ("Runtime flow — tool registration/invocation" and
 * "Data flow — publish, install, serve"); keep them in step with that doc.
 */

export const llmFirstNodes: readonly FlowNode[] = [
  { id: "you", kicker: "You", label: "Your terminal", col: 1, row: 1 },
  {
    id: "agent",
    kicker: "Agent",
    label: "LLM + MCP client",
    detail: "any MCP client",
    col: 2,
    row: 1,
  },
  {
    id: "mcp",
    kicker: "Package",
    label: "Registry MCP server",
    detail: "webmcp-today-mcp · stdio",
    col: 3,
    row: 1,
  },
  {
    id: "ext",
    kicker: "Your browser",
    label: "Extension",
    detail: "background worker",
    col: 1,
    row: 2,
  },
  { id: "api", kicker: "Registry", label: "REST API", detail: "/api/packages/*", col: 2, row: 2 },
  {
    id: "db",
    kicker: "Registry",
    label: "Neon Postgres",
    detail: "packages · versions · installs",
    col: 2,
    row: 3,
  },
  {
    id: "site",
    kicker: "Target",
    label: "The site",
    detail: "your logged-in session",
    col: 1,
    row: 3,
  },
];

export const llmFirstSteps: readonly FlowStep[] = [
  {
    from: "you",
    to: "agent",
    title: "You ask for something on a site your agent can't operate",
    body: "It can load the page, but it has no tools for it. Only markup to guess at, one rename away from breaking.",
  },
  {
    from: "agent",
    to: "mcp",
    title: "The agent checks the registry before improvising",
    body: "`@robertn702/webmcp-today-mcp` runs over stdio beside the agent and exposes `lookup_package`, `list_packages`, `publish_package` and `install_package`.",
  },
  {
    from: "mcp",
    to: "api",
    elbow: "vertical",
    title: "Which is a thin client over the public REST API",
    body: "`GET /api/packages/lookup?url=…` is the same endpoint the extension calls. Writes carry an `Authorization: Bearer` API key you create in settings.",
  },
  {
    from: "api",
    to: "db",
    title: "Newest version, most specific pattern first",
    body: "Postgres serves each package's latest version, ranked by URL-pattern specificity. Nothing there yet? The agent writes one and calls `publish_package`. It gets zod-validated and stored as version 1.",
  },
  {
    from: "api",
    to: "ext",
    title: "Installing pins you to one exact version",
    body: "`install_package` writes an `installs` row on your webmcp.today account and returns a handoff link. Opening that link drives the install bridge into the extension: the body is fetched, `apiContentHash` is re-verified, and it lands atomically in `chrome.storage.local`. A new upstream version never arrives on its own — moving the pin is a fresh click.",
  },
  {
    from: "ext",
    to: "site",
    title: "And the tools appear on the page",
    body: "The extension registers each pinned tool with `document.modelContext.registerTool()`. Your agent now calls `reddit_comment` instead of hunting for a textarea.",
  },
];

export const inBrowserNodes: readonly FlowNode[] = [
  {
    id: "site",
    kicker: "Target",
    label: "The site",
    detail: "no WebMCP of its own",
    col: 1,
    row: 1,
  },
  {
    id: "cs",
    kicker: "Extension",
    label: "Content script",
    detail: "document_idle",
    col: 2,
    row: 1,
  },
  {
    id: "bg",
    kicker: "Extension",
    label: "Background worker",
    detail: "MV3 service worker",
    col: 3,
    row: 1,
  },
  {
    id: "mc",
    kicker: "The page",
    label: "document.modelContext",
    detail: "injected tools",
    col: 2,
    row: 2,
  },
  {
    id: "store",
    kicker: "Extension",
    label: "Local installs",
    detail: "chrome.storage.local",
    col: 3,
    row: 2,
  },
  { id: "you", kicker: "You", label: "A chat box", col: 1, row: 3 },
  {
    id: "agent",
    kicker: "Agent",
    label: "The browser's agent",
    detail: "in-page / built-in",
    col: 2,
    row: 3,
  },
];

export const inBrowserSteps: readonly FlowStep[] = [
  {
    from: "site",
    to: "cs",
    title: "You open a page",
    body: "At `document_idle` the extension's content script wakes up on whatever site you're on. You're signed in, cookies and all.",
  },
  {
    from: "cs",
    to: "bg",
    title: "The content script hands the URL off",
    body: "The background worker holds the install index and the revocation check, so `browser.runtime.sendMessage` passes the URL to the worker rather than each frame reading storage directly.",
  },
  {
    from: "bg",
    to: "store",
    title: "Match against your installed packages",
    body: "The worker reads the install index from local storage and matches the URL with `domainLookupKeys` + `rankPackagesByUrl`. Only packages you've explicitly installed register — nothing auto-discovers — and revoked versions are dropped at registration time.",
  },
  {
    from: "store",
    to: "mc",
    title: "Matching tools get registered",
    body: "A package whose `minEngine` outranks the extension is skipped whole, never half-registered. The rest go in tool by tool via `registerTool()`. Any name the site already claimed is left alone.",
  },
  {
    from: "you",
    to: "agent",
    title: "You ask the browser's agent",
    body: "No terminal, no API key, no MCP config. Installing the extension is the entire setup.",
  },
  {
    from: "agent",
    to: "mc",
    title: "It sees injected tools as ordinary page tools",
    body: "WebMCP tools carry no provenance today, so a community package is indistinguishable from one the site shipped itself.",
  },
  {
    from: "mc",
    to: "site",
    elbow: "horizontal",
    title: "The executor does the work",
    body: "A same-origin API call riding the cookies you already have — no DOM selectors, no scraping. Anything flagged `destructiveHint` stops for a confirm dialog.",
  },
];
