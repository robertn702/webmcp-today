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

## Dev extension key (stable ID for the install bridge)

The registry site reaches the extension by ID (`externally_connectable` +
`NEXT_PUBLIC_WEBMCP_EXTENSION_IDS`). Without a manifest `key`, Chrome assigns
a random ID per profile and the bridge never connects. Generate a dev keypair
once per machine:

```
openssl genrsa 2048 > key.pem
openssl rsa -in key.pem -pubout -outform DER | base64  # one line; on macOS add -w0 if base64 wraps
```

Put the base64 public key in `apps/extension/.env` as `WXT_EXTENSION_KEY` (the
config spreads it into the manifest only when set). The extension ID that
results — `chrome://extensions` with the build loaded — goes in
`apps/web/.env` `NEXT_PUBLIC_WEBMCP_EXTENSION_IDS` (comma-separated; the
CWS-assigned ID joins the list after first store upload). **NEVER commit
`key.pem` or the key value** — both stay in untracked local config only. A new
key means a new ID; keep `key.pem` backed up off-repo or the dev ID changes.

## Gotchas (hard-won 2026-07-23)

- **One dev instance only.** A second `bun run dev` crashes on the Chrome profile
  lock ("CDP connection closed before response to Extensions.loadUnpacked"), and
  interleaved runs corrupt `.output/` (manifest CSP pinned to a port the live
  server isn't on — extension loads but nothing works). Find strays with
  `lsof -nP -i :3000 -i :5173 -i :9222`; killing the bun wrapper does NOT kill
  the node child.
- **Page loads never hit the network.** The background resolves every URL from
  `chrome.storage.local` (install index + bodies); the registry is only polled
  for revocations. Ground truth is the **page-console** line
  `[webmcp-cafe] N installed package(s) matched this URL`. With an empty store
  every page logs `0 installed package(s)` and registers nothing — that is the
  expected state, not a failure. An actual failure is the warn
  `Lookup failed — the extension background did not answer`.
  To exercise a match without the registry UI, seed `chrome.storage.local`
  from the service-worker console using the keys in `src/lib/store-schema.ts`
  (`schemaVersion`, `index`, `pkg:<id>`, and `revoked` — the last one is
  mandatory: its absence is the fail-closed gate and pages then report
  "paused, waiting on the safety list" instead of matching).
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
- All extension logging (match counts, registered/skipped tools, executor
  failures) lands in the **page console** — not the service worker, not the
  WXT terminal.
- Registry-unreachable signal: a `!` badge plus the popup's "Packages paused —
  waiting on the safety list" means no revocation poll has ever succeeded
  (fail-closed: installed packages stay dormant until `GET /api/revocations`
  succeeds once). Pages in that state report `safety-list-missing` and register
  nothing.
- `destructiveHint` tools gate on a blocking `window.confirm`. Invoked via
  chrome-devtools-mcp, the call surfaces an "open dialog" notice and the write
  waits until a human approves in the browser (or sends `handle_dialog`).

## Structure

- `src/entrypoints/background.ts` — resolves page-load lookups from LOCAL
  storage (`src/lib/local-lookup.ts` over the install index) and polls
  `GET /api/revocations` on a 6h `chrome.alarms` tick + startup/popup-open from
  `WXT_REGISTRY_API_URL` (default `https://webmcp.cafe`; polls only — page
  loads never fetch). Everything crossing a boundary is zod-validated.
- The install bridge: `externally_connectable` (built from
  `src/lib/registry-origins.ts`'s `REGISTRY_MATCH_PATTERNS` — the same constant
  the runtime origin allowlist checks) lets ONLY the registry site reach
  `runtime.onMessageExternal`. `src/lib/install-bridge.ts` handles
  ping/install/uninstall/list-installs (protocol:
  `packages/schema/src/bridge.ts` — both sides validate against it; never
  redeclare the shapes). Install fetches the version body from the SENDER's
  origin, re-verifies `apiContentHash` (mismatch ⇒ distinct `hash-mismatch`
  refusal), bootstraps the revocation list on first install
  (`revocation-unavailable` refusal if that fetch fails — nothing is written),
  and writes body+index in one atomic set. Site side:
  `apps/web/lib/extension-bridge.ts` (probes `NEXT_PUBLIC_WEBMCP_EXTENSION_IDS`)
  - `apps/web/components/install-button.tsx`.
- E2E for the install path (replaces "did the registry fetch work"): `bun run
dev` + web on :3000 → open `/packages/<id>` → click Install via
  chrome-devtools-mcp → popup lists it → navigate to the target site → page
  console shows `[webmcp-cafe] 1 installed package(s) matched this URL` →
  `list_webmcp_tools` shows the tools.
- Storage lives in `chrome.storage.local` under four keys
  (`src/lib/store-schema.ts`): `schemaVersion`, `index` (install metadata),
  `pkg:<id>` (served bodies verbatim), `revoked` (kill list + cursor).
  Read/write goes through `src/lib/installs-store.ts` over an injected
  `StorageArea` seam (`src/lib/storage.ts`); tests use
  `test/fake-storage-area.ts`, never `fakeBrowser`/`wxt/browser`.
- `src/lib/register-tools.ts` — one registration pass (package lookup → WebMCP
  probe → registerTool), taking its side effects as injected deps so it is
  unit-testable; the content script supplies the real ones. A
  `Permissions-Policy: tools=()` page throws `SecurityError` at registerTool —
  reported as the distinct `site-blocked` status, not "package broken".
- `src/entrypoints/popup/` + the action badge — per-tab status, the install
  list (with uninstall), and the paused/recovery states. Never inject UI into
  the page.
- `src/lib/executor.ts` + `steps.ts` — DOM executor ported from Joakim Selemyr's
  MIT webmcp-extension; no `evaluate` step by design.
- The bundled fallback (`@webmcp-cafe/definitions`) is disconnected from the
  page-load path; the dependency itself is removed by step 5b (U7). It remains
  the seed source for the registry (`apps/web/scripts/seed.ts`).
- `public/THIRD-PARTY-LICENSES.md` ships verbatim in the packaged bundle and
  lists the deps the build inlines (currently zod + the MPL-2.0 jmespath).
  Update it whenever bundled dependencies change — including if a tree-shaken
  dep (e.g. `@noble/hashes`) ever starts reaching `.output/`.
