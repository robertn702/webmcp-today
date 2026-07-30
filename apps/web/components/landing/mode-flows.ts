import type { FlowNode, FlowStep } from "./flow-diagram";

/**
 * How a package actually reaches an agent. The sequence is taken from
 * ARCHITECTURE.md ("Runtime flow — tool registration/invocation" and
 * "Data flow — publish, install, serve"); keep it in step with that doc.
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
