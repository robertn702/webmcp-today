# Extension — Internal Architecture

The delivery mechanism for WebMCP Today: injects registry packages' tools into sites
that haven't implemented WebMCP. This document maps the extension's internals — the
three processes Chrome MV3 forces on us, the four flows every `src/lib/` file serves,
and where to look when something breaks. System-level flows (registration, invocation,
publish/install sequence diagrams): root `ARCHITECTURE.md`. Operational gotchas (dev
browser, storage keys, E2E recipe): `apps/extension/AGENTS.md`.

## The three processes

MV3 isolates the extension into three execution contexts that can only talk via
messages. Every lib file exists to serve one of them:

```mermaid
flowchart TB
    subgraph Site["Registry site (webmcp.today)"]
        UI["Install button<br/>(apps/web/components/install-button.tsx)"]
    end

    subgraph BG["Background service worker — entrypoints/background.ts"]
        BRIDGE["install-bridge.ts"]
        LOOKUP["local-lookup.ts"]
        POLLS["revocations.ts · domains.ts · suggestions.ts"]
        STORE["installs-store.ts"]
        ST[("chrome.storage.local<br/>store-schema.ts · storage.ts")]
        BRIDGE --> STORE --> ST
        POLLS --> ST
        LOOKUP --> ST
    end

    subgraph CS["Content script — entrypoints/content.ts (runs on every page)"]
        PKG["packages.ts · lookup-client.ts"]
        REG["register-tools.ts"]
        NAV["navigation.ts"]
        EXEC["@robertn702/webmcp-today-engine<br/>(packages/engine)"]
        PKG --> REG
        NAV --> REG
        REG --> EXEC
    end

    subgraph POP["Popup — entrypoints/popup/"]
        VIEWS["main.ts · views.ts"]
    end

    UI -- "externally_connectable messages" --> BRIDGE
    PKG -- "getPackagesForUrl" --> LOOKUP
    POP -- "status / uninstall" --> BG
    REG -- "registerTool()" --> MC["document.modelContext<br/>(WebMCP API)"]
```

- **Background worker — the librarian.** Owns `chrome.storage.local`, handles
  installs, resolves lookups, and makes _all_ of the extension's network calls (three
  polls, on `chrome.alarms`). Never touches a page.
- **Content script — the registrar + executor.** Runs at `document_idle` on every
  page, asks the background "anything installed for this URL?", registers surviving
  tools with the page's WebMCP API, and executes them when an agent calls. All
  logging lands in the page console.
- **Popup — the dashboard.** Read-mostly UI over the background's state: what matched
  this tab, the install list (with uninstall), paused/recovery states, suggestions.
  Never injects UI into the page.
- **Local bridge — capability relay.** The native host accepts only the versioned
  list-tabs/list-tools/execute-tool protocol. The service worker forwards those
  operations only to the user's active tab; the content script uses WebMCP's
  `getTools()` and `executeTool()` consumer APIs. Tool handles never cross a
  JSON boundary: descriptors are re-resolved after document and `toolchange`
  generations are checked. The host runs no shell, files, URL, JavaScript, or
  CDP commands; its private Unix socket is authenticated with a per-host secret.
  Its stable discovery symlink is last-known-session data: a normal host exit removes
  the private socket/config but leaves a harmless dangling path, and the next session
  atomically replaces it. A successful socket connection, not the path's presence,
  establishes bridge availability.

## The four flows

`src/lib/` has 26 files but only four jobs. Read the directory by flow, not
alphabetically.

### ① Install flow — registry site → storage

_The site says "install"; the background validates and stores._

```mermaid
flowchart LR
    SITE["webmcp.today"] --> BRIDGE["install-bridge.ts"]
    ORIGINS["registry-origins.ts<br/>(sender allowlist)"] --> BRIDGE
    GATE["engine-gate (packages/engine)<br/>(minEngine check)"] --> BRIDGE
    REV["revocations.ts<br/>(bootstrap safety list)"] --> BRIDGE
    BRIDGE --> STORE["installs-store.ts<br/>(atomic body+index write)"]
    STORE --> ST[("chrome.storage.local")]
    SCHEMA["store-schema.ts<br/>(zod shapes of every key)"] --> STORE
    ADAPTER["storage.ts<br/>(the only chrome.* adapter)"] --> STORE
```

- `install-bridge.ts` — the bouncer. Validates the sender origin against
  `registry-origins.ts`'s allowlist (the same constant `wxt.config.ts` turns into
  `externally_connectable` manifest patterns), fetches the version body from the
  _sender's_ origin, re-verifies `apiContentHash`, and bootstraps the revocation list
  on first install (refuses with `revocation-unavailable` if it can't — nothing is
  written).
- `installs-store.ts` — atomic install, ordered uninstall, orphan GC, body loading.
  All storage I/O goes through an injected `StorageArea` seam (`storage.ts`) so tests
  use a fake, never `wxt/browser`.

### ② Page-load flow — URL → tools registered

_The hot path, on every page the user visits. Purely local — no network._

```mermaid
flowchart TB
    CS["content.ts"] --> PKG["packages.ts<br/>(diagnostics wrapper)"]
    CS --> NAV["navigation.ts<br/>(SPA re-registration via<br/>location.href polling)"]
    PKG --> CLIENT["lookup-client.ts<br/>(typed message to background)"]
    NAV --> REG
    CLIENT -- "message" --> LL["local-lookup.ts (background)"]
    LL --> MATCH["match-installed.ts<br/>(URL match + specificity rank)"]
    LL --> REV["revocations.ts<br/>(kill-list check — fail-closed)"]
    LL --> REG["register-tools.ts (content script)"]
    GATE["engine-gate (packages/engine)"] --> REG
    MODEL["model-context.ts<br/>(document ?? navigator.modelContext probe)"] --> REG
    REG -- "registerTool() per surviving tool" --> MC["WebMCP API"]
    REG --> STATUS["status.ts<br/>(registered / skipped /<br/>site-blocked / broken)"]
```

- `register-tools.ts` — one registration pass (lookup → probe → skip
  engine-gated/colliding tools → register), with side effects injected so it is
  unit-testable. Reports `site-blocked` distinctly when a `Permissions-Policy:
tools=()` page throws `SecurityError`.
- `navigation.ts` — content scripts can't see the page's `history.pushState`
  (isolated world), so SPA navigation is detected by polling `location.href`.
  Install-index and revocation-list storage changes explicitly force a same-URL
  pass, so already-open tabs update without a refresh. Every re-run gets a fresh
  abort signal; don't "fix" SPA detection by patching history.

### ③ Tool-invocation flow — agent calls a tool

_What happens when the in-page LLM invokes a registered tool._

```mermaid
flowchart TB
    CB["registerTool execute callback"] --> API["api-executor (packages/engine)<br/>(same-origin fetch, auth tokens,<br/>JMESPath projection,<br/>destructiveHint confirm)"]
    API --> RESULT["mcp-result (packages/engine)<br/>(text → WebMCP result shape)"]
```

`api-executor` (in `packages/engine/src/api-executor.ts`, MIT — extracted from
`src/lib/` for license separation, `docs/DECISIONS.md` 2026-07-30) is the only
executor — DOM mode was cut pre-launch
(`docs/DECISIONS.md` 2026-07-28). It binds `{{param}}` templates from validated
input, acquires tokens from the package's `api.auth` sources, performs the
same-origin fetch, checks `errorPath`, and applies the `returns` projection.

### ④ Safety & discovery flow — background polling → popup

_The only network calls the extension makes, all on timers._

```mermaid
flowchart LR
    ALARM["chrome.alarms<br/>(6h + startup + popup-open)"] --> REV["revocations.ts<br/>(GET /api/revocations?since=cursor)"]
    ALARM --> DOMS["domains.ts<br/>(GET /api/domains — badge)"]
    ALARM --> SUG["suggestions.ts<br/>(popup discovery section)"]
    REV --> ST[("chrome.storage.local")]
    DOMS --> ST
```

`revocations.ts` is the fail-closed gate: if no revocation poll has ever succeeded,
installed packages stay dormant ("paused, waiting on the safety list"). The badge and
popup read the polled state; `status.ts` is the shared zod message vocabulary between
all three processes (page status, popup state, uninstall/install-suggestion
messages).

## Where to look when something breaks

| Symptom                                          | Start at                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| A package won't install                          | `install-bridge.ts` → `installs-store.ts`                                                              |
| Tools didn't show up on a page                   | `register-tools.ts` → `local-lookup.ts` → `match-installed.ts`                                         |
| Page console shows `0 installed package(s)`      | expected with an empty store — not a failure                                                           |
| "Paused, waiting on the safety list" / `!` badge | `revocations.ts` (fail-closed gate; no poll has ever succeeded)                                        |
| A tool call fails or returns weird data          | `packages/engine/src/api-executor.ts` (`returns` JMESPath projection, `errorPath`, auth token sources) |
| SPA navigation doesn't re-register tools         | `navigation.ts`                                                                                        |
| What's actually in chrome.storage                | `store-schema.ts` (`schemaVersion`, `index`, `pkg:<id>`, `revoked`)                                    |
| Popup shows the wrong state                      | `status.ts` (message shapes) → `background.ts` badge logic                                             |

## Why `src/lib/` is flat

The internal import graph is acyclic and shallow (`store-schema.ts` at
the bottom, `register-tools.ts` at the top), and each file's name already says which
flow it serves (`lookup-*`, `*-store`). Subdirectories would duplicate
what the naming already encodes.
