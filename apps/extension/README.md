# WebMCP Today extension

WXT extension that injects community WebMCP packages into sites that haven't
implemented WebMCP themselves. Packages are installed explicitly from
webmcp.today, stored in `chrome.storage.local`, and registered on matching pages.
Page loads do not ask the registry what to run.

## Registry integration

- The registry site's install button uses the validated external message bridge;
  the popup's discovery suggestions use an internal message. Both enter the same
  install path: fetch the requested package and version IDs, validate the served
  schema, check revocation, and store the package locally.
- Page loads resolve matching packages entirely from local storage. The registry
  is contacted only for installs, revocation/domain polling, and a daily optional
  release-metadata poll for the unpacked-extension update notice.
- Base URL: `WXT_REGISTRY_API_URL` build-time env var (see `.env.example`),
  defaulting to `https://webmcp.today`. WXT inlines `WXT_`-prefixed variables at
  build time.

## Status surface (badge + popup)

Every registration pass reports its outcome to the background script, which
mirrors it on the action badge and in the popup:

| Situation                          | Badge      | Popup                                               |
| ---------------------------------- | ---------- | --------------------------------------------------- |
| Packages matched, tools registered | tool count | the registered tool names                           |
| No package matches the URL         | cleared    | "No tools for this page"                            |
| Background has no status yet       | unchanged  | "reload the page" (service worker restarts lose it) |

Tools register even without Chrome's WebMCP flag: when no native API is exposed,
a built-in document-local fallback holds the tools and the local bridge serves
them (see `src/lib/model-context-fallback.ts`). The flag only matters for
Chrome's own native agent, which cannot see fallback-registered tools.

No extra permissions back this — the badge comes with the `action` key that the
popup entrypoint already adds.

## Self-hosted extension updates

Unpacked releases cannot replace their own files. Once daily, the background checks
`GET /api/extension/latest`, validates its inert stable-release metadata, and stores
the last valid result locally. Only the known self-hosted release ID loaded through
Developer mode sees a popup notice when that version is newer; local development,
managed, and Chrome Web Store installs never see it. The notice links to
`https://webmcp.today/extension#update-unpacked`; it never downloads, installs, or
executes remote code.

## Registration lifecycle

`src/lib/navigation.ts` runs a registration pass for the current URL and another
on every URL change, so a client-side route change re-matches packages instead of
leaving the previous route's tools behind. Each pass gets its own
`AbortController`, passed to `registerTool` as `{ signal }`; the next navigation
aborts it, which is what unregisters that pass's tools. Passes are serialized and
an unchanged URL event is a no-op.

The content script also forces a same-URL pass when the local install index or
revocation list changes. Installing a matching package while its site is already
open therefore registers its tools without a refresh; uninstalling or revoking it
aborts the previous pass and removes its tools the same way.

Detection is `popstate` + `hashchange` plus a 500 ms poll of `location.href`. The
poll is load-bearing: `history.pushState` is the usual SPA route change, and a
content script cannot see it — patching `history` from the isolated world only
intercepts the isolated world's own calls. The event-driven alternative is
`chrome.webNavigation.onHistoryStateUpdated` in the background script, which
costs a "read your browsing history" permission warning on the store listing.

## Dev browser

`bun run dev` launches a **separate** Chrome instance with its own profile —
flags and extensions from your main profile don't apply there. The WXT config
handles this: WebMCP is force-enabled via `--enable-features` launch args (no
chrome://flags needed), and the profile persists in `.wxt/chrome-profile`, so
install the Model Context Tool Inspector once in that browser and it sticks.
Requires Chrome 149+ (any channel).

Note: `chrome://flags` in the dev browser will still show WebMCP entries as
"Default" — features set via `--enable-features` bypass that UI entirely. The
ground truth is `chrome://version` → Command Line, which lists the live flags.

## Full-loop manual test (publish → extension serves it)

This exercises the real path: a package published through the registry API,
installed from its package page or the popup's discovery suggestions, and
injected as a tool in a live page.

1. **Start the registry** — in `apps/web`, ensure `.env` points at the real
   seeded Neon DB (see `apps/web/.env.example`), then `bun run dev` (defaults
   to `http://localhost:3000`).
2. **Get an API key** — sign in at `http://localhost:3000/auth/sign-in`
   (GitHub or email/password) and create an agent API key at
   `http://localhost:3000/settings/security` (shown once).
3. **Publish a package** — POST one of the bundled fixtures (already valid
   against `createPackageSchema`), e.g.:
   ```bash
   curl -X POST http://localhost:3000/api/packages \
     -H "Authorization: Bearer <your-api-key>" \
     -H "Content-Type: application/json" \
     --data @packages/curated-packages/data/reddit.com.json
   ```
   Note the returned `id`.
4. **Confirm it's served** — publishing makes the package immediately readable
   (the lookup endpoint serves each package's latest version; there is no
   verification gate). Check in a browser:
   `GET http://localhost:3000/api/packages/lookup?url=<a matching page url>`.
   The seeded packages are also immediately servable, so you can skip steps
   3–4 entirely and just look up a seeded domain (e.g. a Reddit page).
5. **Load the extension** — Chrome Canary/Dev (149+) with
   `chrome://flags/#enable-webmcp-testing`, install the Model Context Tool
   Inspector extension from the Chrome Web Store, then `bun run dev` here
   (or `bun run build` + load `.output/chrome-mv3` unpacked).
6. **Install it** — open the package page in the registry and click Install.
   Confirm the extension popup lists the package.
7. **Visit the site** — open a page matching the package's `urlPatterns` and
   check the page console reports a match and the Inspector lists its tools.
8. Invoke a read-only tool and confirm the output.

## Known limitations (spike)

- SPA route changes are detected by a 500 ms URL poll (plus `popstate` /
  `hashchange`), so for up to half a second after a client-side navigation the
  previous route's tools are still the registered ones. See "SPA navigation".
- Without Chrome's `chrome://flags/#enable-webmcp-testing` flag, tools are
  reachable only through the WebMCP Today bridge, not Chrome's native agent —
  there is no origin-trial path for injected tools. The built-in fallback
  registers them anyway; it just can't expose them to Chrome's own agent.
- Registration from a content script is unsanctioned upstream, and sites can
  reject injected tools outright via `Permissions-Policy: tools=()` (Chrome
  150+) — see docs/platform-risks.md.
- Discovery suggestions have no retry loop; a failed popup fetch shows the
  registry-unavailable state and the next popup open tries again. Page loads
  never fetch packages from the registry.
