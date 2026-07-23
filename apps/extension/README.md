# WebMCP Cafe extension

WXT extension that injects community WebMCP tool configs into sites that haven't
implemented WebMCP themselves. It fetches verified configs for the current page from
the webmcp.cafe registry API, falling back to the bundled configs in `configs/` when
the registry has nothing for the domain or is unreachable.

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
  back to the bundled `configs/` dir.
- `yolo=true` (unverified configs) is intentionally never sent — the
  extension only asks for verified configs.
- Base URL: `WXT_REGISTRY_API_URL` build-time env var (see `.env.example`),
  defaulting to `http://localhost:3000` in code when unset. WXT inlines any
  `WXT_`-prefixed var into `import.meta.env` at build time (Vite's env
  handling), so it's not available in `process.env` at runtime.
- `host_permissions` in `wxt.config.ts` lists both the dev
  (`http://localhost:3000/*`) and production (`https://webmcp.cafe/*`)
  origins, since manifest permissions are fixed at build time and can't read
  the env var.

## Full-loop manual test (publish → extension serves it)

This exercises the real path: a config published through the registry API
ends up injected as a tool in a live page.

1. **Start the registry** — in `apps/web`, ensure `.env` points at the real
   seeded Neon DB (see `apps/web/.env.example`), then `bun run dev` (defaults
   to `http://localhost:3000`).
2. **Get an API key** — sign in with GitHub at `http://localhost:3000/settings`
   and create an agent API key from the Settings page (shown once).
3. **Publish a config** — POST one of the bundled fixtures (already valid
   against `createConfigSchema`), e.g.:
   ```bash
   curl -X POST http://localhost:3000/api/configs \
     -H "Authorization: Bearer <your-api-key>" \
     -H "Content-Type: application/json" \
     --data @apps/extension/configs/en.wikipedia.org.json
   ```
   Note the returned `id`.
4. **Verify it** — the lookup endpoint serves verified tools only by
   default, and a contributor can't verify their own config, so sign in
   with a _second_ GitHub account (or ask a teammate) and, per tool name in
   the config:

   ```bash
   curl -X POST http://localhost:3000/api/configs/<id>/verify \
     -H "Cookie: <second account's session cookie>" \
     -H "Content-Type: application/json" \
     -d '{"toolName": "wiki_summary"}'
   ```

   (Repeat per tool. For a quick solo smoke test instead of verifying, you
   can hit `GET /api/configs/lookup?url=...&yolo=true` directly in a browser
   to confirm the unverified config is retrievable — the extension itself
   never sets `yolo`.)

   **Solo shortcut — no second account needed:** the seeded configs'
   contributor is the synthetic seed user, so _your_ signed-in account is a
   valid verifier for them. Skip steps 3–4, open the seeded config's detail
   page (`http://localhost:3000/configs/<id>`, find it from the homepage
   list), and click **Verify** per tool. The non-`yolo` lookup then serves
   it, which is all the extension needs.

5. **Load the extension** — Chrome Canary/Dev (149+) with
   `chrome://flags/#enable-webmcp-testing`, install the Model Context Tool
   Inspector extension from the Chrome Web Store, then `bun run dev` here
   (or `bun run build` + load `.output/chrome-mv3` unpacked).
6. **Visit the site** — open the page matching the config's `urlPattern`
   (e.g. an `en.wikipedia.org` article) and check the Inspector lists the
   tool(s) from step 3/4. Check the background service worker's console
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
   `configs/` fallback).
5. Invoke a read-only tool (e.g. `hn_list_stories`) and confirm the output.

## Known limitations (spike)

- Tools register once per page load; SPA route changes don't re-match configs.
- Registration from a content script relies on the testing flag relaxing
  WebMCP's origin-isolation gate; whether that survives the stable release is
  an open question (see AGENTS.md).
- No caching or retry around the registry fetch — a single request per page
  load, falling back to bundled configs on any failure (simplicity bias; this
  is still a spike).
