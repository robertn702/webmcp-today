# AGENTS.md — apps/extension

Extension-specific notes. Repo-wide guidance: root `AGENTS.md` (read it first).

## Dev browser

- `bun run dev` launches a **separate** Chrome with its own persistent profile
  (`.wxt/chrome-profile/`, gitignored). WebMCP features are force-enabled via
  `chromiumArgs` (`--enable-features=WebMCP,WebMCPTesting,DevToolsWebMCPSupport`)
  — `chrome://flags` will still show "Default"; `chrome://version` → Command Line
  is ground truth.
- Ports: registry web app 3000, WXT dev server 5173, CDP remote debugging 9222.
  The CDP port is what lets chrome-devtools-mcp (registered in the repo-root
  `opencode.json`) attach and drive the page's WebMCP tools.
- The Model Context Tool Inspector must be installed manually **once** in the dev
  browser (profile persists). `--load-extension` is dead in branded Chrome 137+.

## Gotchas (hard-won 2026-07-23)

- **One dev instance only.** A second `bun run dev` crashes on the Chrome profile
  lock ("CDP connection closed before response to Extensions.loadUnpacked"), and
  interleaved runs corrupt `.output/` (manifest CSP pinned to a port the live
  server isn't on — extension loads but nothing works). Find strays with
  `lsof -nP -i :3000 -i :5173 -i :9222`; killing the bun wrapper does NOT kill
  the node child.
- **Silent-fallback trap.** The registry lookup is fetched in the background
  worker (CSP sidestep) but the content script logs the outcome, so watch the
  **page console**: any failure (network, non-2xx, zero matches, or schema
  mismatch) silently falls back to the bundled curated packages, and a "working"
  test may never touch the registry. Any full-loop claim must cite the page-console
  line `[webmcp-cafe] Using N package(s) from the registry` (vs the fallback variant).
- **Isolated-world blind spot.** A content script cannot see the page's
  `history.pushState` — patching `history` only intercepts the isolated world's
  own calls, so SPA navigation is detected by polling `location.href`
  (`src/lib/navigation.ts`). Don't "fix" it by monkey-patching history.
- **Selector-rot debugging recipe.** Evaluate the package's `resultSelector`
  against the live page via the chrome-devtools bridge (`evaluate_script`)
  before touching code. Wikipedia's Parsoid DOM (`.mw-parser-output > section`
  wrappers) broke `wiki_summary` on day one.

## E2E testing (chrome-devtools-mcp)

- Drive the dev browser's page tools with chrome-devtools-mcp
  (`--browser-url=http://127.0.0.1:9222 --category-experimental-webmcp`):
  `list_webmcp_tools` / `execute_webmcp_tool`. If the agent session lacks that
  server, spawn it over stdio — `packages/mcp/.scratch/call-tool.mjs`
  (`bun ... <toolName> '<inputJson>'`) is a working driver.
- All extension logging (package source, registered/skipped tools, executor
  failures) lands in the **page console** — not the service worker, not the
  WXT terminal.
- `reddit.com` is deliberately excluded from the bundled fallback
  (`BUNDLED_DOMAINS` in `src/lib/packages.ts`) — on reddit.com, no log line + no
  tools registered = the registry lookup failed.
- `destructiveHint` tools gate on a blocking `window.confirm`. Invoked via
  chrome-devtools-mcp, the call surfaces an "open dialog" notice and the write
  waits until a human approves in the browser (or sends `handle_dialog`).

## Structure

- `src/entrypoints/background.ts` — fetches packages from the registry
  (`WXT_REGISTRY_API_URL`, default `http://localhost:3000`); content script asks
  via `browser.runtime.sendMessage`. Registry responses are zod-validated with
  `webMcpPackageSchema` at the boundary.
- `src/lib/register-tools.ts` — one registration pass (package lookup → WebMCP
  probe → registerTool), taking its side effects as injected deps so it is
  unit-testable; the content script supplies the real ones.
- `src/entrypoints/popup/` + the action badge — where a missing WebMCP API is
  surfaced (page-console `console.warn` too). Never inject UI into the page.
- `src/lib/executor.ts` + `steps.ts` — DOM executor ported from Joakim Selemyr's
  MIT webmcp-extension; no `evaluate` step by design.
- Bundled fallback packages come from `@webmcp-cafe/definitions`
  (`packages/definitions`), which is also the seed source for the registry
  (`apps/web/scripts/seed.ts`).
