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
- **Silent-fallback trap.** The background fetch requests verified configs only
  (never `yolo=true`); unverified configs make it fall back to the bundled
  `configs/` dir. A "working" test may never touch the registry. Any full-loop
  claim must cite the service-worker log line
  `[webmcp-cafe] Using N config(s) from the registry` (vs the fallback variant).
- **Selector-rot debugging recipe.** Evaluate the config's `resultSelector`
  against the live page via the chrome-devtools bridge (`evaluate_script`)
  before touching code. Wikipedia's Parsoid DOM (`.mw-parser-output > section`
  wrappers) broke `wiki_summary` on day one.

## Structure

- `src/entrypoints/background.ts` — fetches configs from the registry
  (`WXT_REGISTRY_API_URL`, default `http://localhost:3000`); content script asks
  via `browser.runtime.sendMessage`. Registry responses are zod-validated with
  `webMcpConfigSchema` at the boundary.
- `src/lib/executor.ts` + `steps.ts` — DOM executor ported from Joakim Selemyr's
  MIT webmcp-extension; no `evaluate` step by design.
- `configs/*.json` — bundled fallback configs; also the seed source for the
  registry (`apps/web/scripts/seed.ts`).
