# Backlog

Open follow-ups, grouped by launch scope then roughly next-first. One line per
item — detail lives at the linked doc, not here. Rules: an item with no pointer
to detail gets deleted on sight; whoever completes an item deletes it in the
same PR. Not a wishlist.

**Launch (MVP) =** public announcement of `webmcp.cafe` to a developer audience
— WebMCP is flag/origin-trial gated through Chrome 156, so every early user runs
Chrome with `#enable-webmcp-testing` and drives tools from the Tool Inspector or
their own agent. Tier-1 configs only; extension installed unpacked or via CWS.

## Before launch (MVP)

### Blocking

- **Landing page** — marketing `/` ("Greasyfork for the agentic web" pitch);
  decide what happens to the current root browse view (move to /configs?).
  Needs a content/design call first. (AGENTS.md → What this is)
- **Docs page** — config format, publishing guide, extension install guide;
  source content exists in docs/ + apps/extension/README.md to adapt.
  (docs/api-execution-model.md, packages/schema)
- **Approval-before-publish vs open-publish + moderation** — leaning
  open-publish for tier 1, human review queue for tier-2/3 code; undecided.
  Needs an answer _and_ a report/takedown path before publishing opens to
  strangers — tier-1 `api` configs can POST to arbitrary endpoints from a
  logged-in session. Governs _what gets published_; pairs with the pinning item
  below, which governs _what changes after you trusted it_.
  (docs/api-execution-model.md → Open questions)
- **Factor in installed webmcp configs** (security) — the extension fetches
  unauthenticated and never sends `installed=true`, so it serves latest
  versions, not the user's pinned ones: a publisher can append a malicious v2
  that lands silently in every install. Auth piggybacks on the web app session
  — `getAuthUserId` already resolves cookie sessions and host permissions
  exempt the background fetch from CORS, so the client just needs
  `credentials: "include"`. Open: verify Chrome sends the cookie (SameSite
  exemption for host-permitted extension requests), decide the merge policy
  (`installed=true` returns _only_ installs, dropping discovery of
  uninstalled configs), and surface signed-out state — silent downgrade to
  latest defeats the pin. (apps/extension/src/entrypoints/background.ts:31;
  apps/web/lib/api-auth.ts; apps/web/AGENTS.md → served truth)
- **Chrome Web Store distribution decision** — CWS listing at launch vs.
  unpacked install (users already need `#enable-webmcp-testing`). Precedent:
  the reference impl (WebMCP Hub) shipped this exact category — remote-registry
  lookup + content-script registration — to CWS in Feb 2026, so reviewer risk
  is lower than feared; position the listing as declarative configs interpreted
  by a bundled executor (no `evaluate`, no remote code) with a no-data-collected
  declaration. Submit early regardless: review turnaround is the constraint.
  Zero-review fallback worth a compatibility check — Hub's popup accepts a
  custom hub URL, so its store-approved build could be pointed at our
  `GET /api/configs/lookup`. Needs Robert: $5 developer account, listing
  identity, privacy policy page. The tiers 2–3 "no remote code" answer can
  follow later. (docs/DECISIONS.md 2026-07-24 Hub survey;
  docs/api-execution-model.md → Open questions)
- **Switch Namecheap nameservers to Cloudflare** — the last step before
  `webmcp.cafe` resolves; Robert's action, then propagation time.
  (AGENTS.md → Deploy, domain & DNS)
- **Re-register on SPA navigation** — content script registers once at
  document_idle (content.ts main); SPA route changes never re-match configs
  or drop stale tools. Add a history/URL-change listener + idempotent re-run;
  Hub looks configs up per navigation from the background script, which is the
  shape to copy. (apps/extension/README.md → Known limitations;
  docs/DECISIONS.md 2026-07-24)
- **Email service** (password reset, verification) — pick a provider (needs
  Robert: Resend/Postmark/SES + env creds), then set
  `emailAndPassword.sendResetPassword` in apps/web/lib/auth.ts and flip
  `forgotPassword`/`requireEmailVerification` back on in
  components/providers.tsx. Zero-work alternative for launch: disable
  email+password and ship GitHub-OAuth-only. (apps/web/AGENTS.md → Auth)

### Cheap now, expensive after launch

- **Vercel preview deploys fail on every PR** — t3-env "Invalid environment
  variables" at page-data collection; the Vercel project lacks the required
  env vars for preview builds (pre-existing, seen on PRs 19–21; main itself
  has no Vercel check). Add the env vars in Vercel (needs Robert's creds) or
  relax build-time validation for previews. Do not point Preview at the prod
  `DATABASE_URL`/auth secrets — every PR branch gets an ungated preview URL.
  (apps/web/env.ts; AGENTS.md notes builds need real env vars)
- **Param-description budget gap** — `inputSchema` property descriptions allow
  1,000 chars vs Chrome's 150 guidance; DOM `fields[]` enforce 150, API tools
  bypass it. Align or consciously relax — tightening it after strangers publish
  invalidates stored configs. (packages/schema/src/input-schema.ts vs fields.ts)
- **`returns` projection for `reddit_comment`** — write output is Reddit's raw
  rendered HTML; project errors/permalink instead. Publish as v2 of the config
  (first exercise of the version-append path — worth proving before strangers
  hit it). (docs/DECISIONS.md 2026-07-24 tier-1 e2e entry, item 4)
- **Handle `SecurityError` on registration** — sites can reject injected tools
  via `Permissions-Policy: tools=()` (Chrome 150+); today a rejected
  `registerTool` would just fail. Catch it and mark the config site-blocked
  rather than silently degrading. (docs/platform-risks.md → tools=())

## After launch

### Web app

- **Google OAuth** — `socialProviders.google` in apps/web/lib/auth.ts +
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` env (apps/web/.env.example);
  better-auth-ui picks it up automatically. (apps/web/AGENTS.md → Auth)
- **Config search** — search across definitions (domain/title/description/
  tool names) in the registry UI; browse is currently domain-filter + pagination
  only. (apps/web/app/api/configs/route.ts GET)
- **Show official webmcps** — surface sites that ship their own first-party
  WebMCP tools (no injection needed) alongside community configs; decide the
  data model (curated list vs. detection) before building.
- **Blog** (low prio) — launch/announcement posts; MDX route group is the
  simple path. Defer until landing + docs exist.

### Extension / executor

- **Chat UI** — embedded chat panel in the extension so users can drive the
  page's WebMCP tools without a terminal agent (today's loop needs opencode +
  chrome-devtools-mcp). Needs a design call: model/API-key story, panel
  placement. (apps/extension/AGENTS.md → E2E testing shows the manual loop
  this would replace)
- **MV3 spike for tier-2 script slots** — execute a registry-delivered string
  function under MV3 on GitHub (strict CSP) + Reddit via `chrome.userScripts`
  vs a packaged runner; document permissions friction. Gates tiers 2–3.
  (docs/api-execution-model.md → "MV3 constraints + spike plan", build-order 4)
- **APQ / `persistedQuery` support** — executor currently throws on it; needs
  hash + retry + cross-call cache. Blocks any real GraphQL config (e.g. Reddit
  shreddit search). (apps/extension/src/lib/api-executor.ts TODO;
  docs/api-execution-model.md → "GraphQL support")

### Schema

- **Output-projection language** — `returns` grammar is dot-paths + `[]` +
  `{a,b}` pickers; anything richer is a deferred decision.
  (docs/api-execution-model.md → Open questions)

### Design questions (need a decision before building)

- **Per-user/per-model output budget** — hard 1.5K truncation removed for v1;
  design the customization (e.g. extension setting) when usage says verbose
  outputs hurt. (docs/DECISIONS.md 2026-07-24 removal entry)
- **Health canary for API configs** — loud failures need a listener; what runs
  it, and how are auth'd writes canaried safely? (docs/api-execution-model.md
  → Open questions)
- **`ctx` composition for tier-2/3** — what slots/scripts receive (auth tokens,
  prior step outputs, endpoint metadata) is under-specified; pin down when the
  executor is built. (docs/api-execution-model.md → Open questions)
