# WebMCP Cafe extension

WXT extension that injects community WebMCP tool configs into sites that haven't
implemented WebMCP themselves. It fetches each definition's latest published
version for the current page from the webmcp.cafe registry API, falling back to
the bundled curated configs (`@webmcp-cafe/definitions`) when the registry has
nothing for the domain or is unreachable.

The DOM executor is ported from Joakim Selemyr's MIT-licensed
[webmcp-extension](https://github.com/Joakim-Sael/webmcp-extension) — credit to
him for the hard-won tricks: native prototype value setter for React inputs,
synthetic paste events for Lexical/Draft editors, shadow-DOM-deep queries,
`:has-text()` selectors, `isTrusted` clicks. Deliberate difference: the
`evaluate` step is not ported — no arbitrary code execution in the user's
logged-in page.

## Registry integration

- `GET <base>/api/configs/lookup?url=<page url>` runs from the **background
  script**, not the content script — this hits the registry's own origin
  directly instead of going through the page's `fetch`, sidestepping any
  page CSP `connect-src` restrictions rather than fighting them. The content
  script asks for configs via `browser.runtime.sendMessage`.
- The response is validated at that boundary with the zod schemas from
  `@robertn702/webmcp-cafe-schema` (`webMcpConfigSchema`); anything that
  fails to parse, along with network errors and non-2xx responses, falls
  back to the bundled curated configs.
- The lookup endpoint serves each definition's latest published version; the
  extension fetches unauthenticated, so it never sends `installed=true` (the
  authenticated variant that serves a user's pinned versions).
- Base URL: `WXT_REGISTRY_API_URL` build-time env var (see `.env.example`),
  defaulting to `http://localhost:3000` in code when unset. WXT inlines any
  `WXT_`-prefixed var into `import.meta.env` at build time (Vite's env
  handling), so it's not available in `process.env` at runtime.
- `host_permissions` in `wxt.config.ts` lists both the dev
  (`http://localhost:3000/*`) and production (`https://webmcp.cafe/*`)
  origins, since manifest permissions are fixed at build time and can't read
  the env var.

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

This exercises the real path: a config published through the registry API
ends up injected as a tool in a live page.

1. **Start the registry** — in `apps/web`, ensure `.env` points at the real
   seeded Neon DB (see `apps/web/.env.example`), then `bun run dev` (defaults
   to `http://localhost:3000`).
2. **Get an API key** — sign in at `http://localhost:3000/auth/sign-in`
   (GitHub or email/password) and create an agent API key at
   `http://localhost:3000/settings/security` (shown once).
3. **Publish a config** — POST one of the bundled fixtures (already valid
   against `createConfigSchema`), e.g.:
   ```bash
   curl -X POST http://localhost:3000/api/configs \
     -H "Authorization: Bearer <your-api-key>" \
     -H "Content-Type: application/json" \
     --data @packages/definitions/configs/en.wikipedia.org.json
   ```
   Note the returned `id`.
4. **Confirm it's served** — publishing makes the config immediately servable
   (the lookup endpoint serves each definition's latest version; there is no
   verification gate). Check in a browser:
   `GET http://localhost:3000/api/configs/lookup?url=<a matching page url>`.
   The seeded configs are also immediately servable, so you can skip steps
   3–4 entirely and just look up a seeded domain (e.g. an
   `en.wikipedia.org` article).
5. **Load the extension** — Chrome Canary/Dev (149+) with
   `chrome://flags/#enable-webmcp-testing`, install the Model Context Tool
   Inspector extension from the Chrome Web Store, then `bun run dev` here
   (or `bun run build` + load `.output/chrome-mv3` unpacked).
6. **Visit the site** — open a page matching one of the config's `urlPatterns`
   (e.g. an `en.wikipedia.org` article) and check the Inspector lists the
   tool(s) from step 3. Check the background service worker's console
   (`chrome://extensions` → the extension's "service worker" link) for
   `[webmcp-cafe]` logs confirming a registry hit vs. bundled fallback.
7. Invoke a read-only tool and confirm the output.

## Manual verification (bundled configs only, no registry)

1. Chrome Canary/Dev (149+) with `chrome://flags/#enable-webmcp-testing`.
2. Install the Model Context Tool Inspector extension from the Chrome Web Store.
3. `bun run dev` here (with no registry running, or pointed at a URL that 404s)
   (or `bun run build` + load `.output/chrome-mv3` unpacked).
4. Visit a configured site (news.ycombinator.com, a GitHub repo, a Wikipedia
   article, MDN, an npm package page) and check the Inspector lists the
   `hn_*` / `gh_*` / `wiki_*` / `mdn_*` / `npm_*` tools (served from the
   bundled fallback).
5. Invoke a read-only tool (e.g. `hn_list_stories`) and confirm the output.

## Known limitations (spike)

- Tools register once per page load; SPA route changes don't re-match configs.
- Registration from a content script relies on the testing flag relaxing
  WebMCP's origin-isolation gate; whether that survives the stable release is
  an open question (see AGENTS.md).
- No caching or retry around the registry fetch — a single request per page
  load, falling back to bundled configs on any failure (simplicity bias; this
  is still a spike).
