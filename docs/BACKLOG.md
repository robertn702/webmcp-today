# Backlog

Open follow-ups, roughly next-first. One line per item — detail lives at the
linked doc, not here. Rules: an item with no pointer to detail gets deleted on
sight; whoever completes an item deletes it in the same PR. Not a wishlist.

## Web app

- **Email service** (password reset, verification) — pick a provider (needs
  Robert: Resend/Postmark/SES + env creds), then set
  `emailAndPassword.sendResetPassword` in apps/web/lib/auth.ts and flip
  `forgotPassword`/`requireEmailVerification` back on in
  components/providers.tsx. (apps/web/AGENTS.md → Auth)
- **Google OAuth** — `socialProviders.google` in apps/web/lib/auth.ts +
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` env (apps/web/.env.example);
  better-auth-ui picks it up automatically. (apps/web/AGENTS.md → Auth)
- **Landing page** — marketing `/` ("Greasyfork for the agentic web" pitch);
  decide what happens to the current root browse view (move to /configs?).
  Needs a content/design call first. (AGENTS.md → What this is)
- **Docs page** — config format, publishing guide, extension install guide;
  source content exists in docs/ + apps/extension/README.md to adapt.
  (docs/api-execution-model.md, packages/schema)
- **Config search** — search across definitions (domain/title/description/
  tool names) in the registry UI; browse is currently domain-filter + pagination
  only. (apps/web/app/api/configs/route.ts GET)
- **Show official webmcps** — surface sites that ship their own first-party
  WebMCP tools (no injection needed) alongside community configs; decide the
  data model (curated list vs. detection) before building.
- **Blog** (low prio) — launch/announcement posts; MDX route group is the
  simple path. Defer until landing + docs exist.

## Extension / executor

- **Re-register on SPA navigation** — content script registers once at
  document_idle (content.ts main); SPA route changes never re-match configs
  or drop stale tools. Add a history/URL-change listener + idempotent re-run.
  (apps/extension/README.md → Known limitations)
- **Chat UI** — embedded chat panel in the extension so users can drive the
  page's WebMCP tools without a terminal agent (today's loop needs opencode +
  chrome-devtools-mcp). Needs a design call: model/API-key story, panel
  placement. (apps/extension/AGENTS.md → E2E testing shows the manual loop
  this would replace)
- **Factor in installed webmcp configs** — the extension fetches
  unauthenticated and never sends `installed=true`, so it serves latest
  versions, not the user's pinned ones. Needs an extension-side auth story
  (API key?) + pinned-version lookup. (apps/extension/README.md → Registry
  integration; apps/web/AGENTS.md → served truth)
- **MV3 spike for tier-2 script slots** — execute a registry-delivered string
  function under MV3 on GitHub (strict CSP) + Reddit via `chrome.userScripts`
  vs a packaged runner; document permissions friction. Gates tiers 2–3.
  (docs/api-execution-model.md → "MV3 constraints + spike plan", build-order 4)
- **APQ / `persistedQuery` support** — executor currently throws on it; needs
  hash + retry + cross-call cache. Blocks any real GraphQL config (e.g. Reddit
  shreddit search). (apps/extension/src/lib/api-executor.ts TODO;
  docs/api-execution-model.md → "GraphQL support")
- **`returns` projection for `reddit_comment`** — write output is Reddit's raw
  rendered HTML; project errors/permalink instead. Publish as v2 of the config
  (first exercise of the version-append path). (docs/DECISIONS.md 2026-07-24
  tier-1 e2e entry, item 4)

## Schema

- **Param-description budget gap** — `inputSchema` property descriptions allow
  1,000 chars vs Chrome's 150 guidance; DOM `fields[]` enforce 150, API tools
  bypass it. Align or consciously relax. (packages/schema/src/input-schema.ts
  vs fields.ts)
- **Output-projection language** — `returns` grammar is dot-paths + `[]` +
  `{a,b}` pickers; anything richer is a deferred decision.
  (docs/api-execution-model.md → Open questions)

## Design questions (need a decision before building)

- **Per-user/per-model output budget** — hard 1.5K truncation removed for v1;
  design the customization (e.g. extension setting) when usage says verbose
  outputs hurt. (docs/DECISIONS.md 2026-07-24 removal entry)
- **Chrome Web Store "no remote code" policy answer** — tiers 2–3 deliver JS
  at runtime; Tampermonkey precedent may not cover us; possibly a store build
  with code tiers disabled. Answer before tiers 2–3 ship.
  (docs/api-execution-model.md → Open questions)
- **Approval-before-publish vs open-publish + moderation** — leaning
  open-publish for tier 1, human review queue for tier-2/3 code; undecided.
  (docs/api-execution-model.md → Open questions)
- **Health canary for API configs** — loud failures need a listener; what runs
  it, and how are auth'd writes canaried safely? (docs/api-execution-model.md
  → Open questions)
- **`ctx` composition for tier-2/3** — what slots/scripts receive (auth tokens,
  prior step outputs, endpoint metadata) is under-specified; pin down when the
  executor is built. (docs/api-execution-model.md → Open questions)
