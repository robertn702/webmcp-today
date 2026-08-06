# Backlog

Open follow-ups, grouped by launch scope then roughly next-first. One line per
item — detail lives at the linked doc, not here. Rules: an item with no pointer
to detail gets deleted on sight; whoever completes an item deletes it in the
same PR. Not a wishlist.

**Launch (MVP) =** public announcement of `webmcp.today` to a developer audience
— WebMCP is flag/origin-trial gated through Chrome 156, so every early user runs
Chrome with `#enable-webmcp-testing` and drives tools from the Tool Inspector or
their own agent. Tier-1 packages only; extension installed unpacked or via CWS.

## Before launch (MVP)

### Blocking

- **Chrome Web Store submission — in review** (2026-07-29): went with CWS at
  launch. v1.0.0 ZIP uploaded (prod-only `https://webmcp.today/*` host perms,
  dev `key` stripped, all four icons), store icon + publisher contact email
  verified. Hit the expected `<all_urls>` content-script warning → in-depth
  review queue; submitted as-is with justification (greasyfork-model needs
  arbitrary sites; Tampermonkey precedent). Research: in-depth reviews run
  1–2 wks typical, 3–4 for new publisher accounts; escalate via One Stop
  Support after 3 wks. Re-review fires on every update while `<all_urls>`
  stays (4–5 days steady-state), one pending review at a time, and
  cancel-and-resubmit resets queue position — so batch releases ~biweekly and
  never cancel a pending review to sneak in a commit.
  Zero-review fallback worth a compatibility check — Hub's popup accepts a
  custom hub URL, so its store-approved build could be pointed at our
  `GET /api/packages/lookup`. The tiers 2–3 "no remote code" answer can
  follow later. (docs/DECISIONS.md 2026-07-24 Hub survey;
  docs/api-execution-model.md → Open questions)
- **Email service** (password reset, verification) — pick a provider (needs
  Robert: Resend/Postmark/SES + env creds), then set
  `emailAndPassword.sendResetPassword` in apps/web/lib/auth.ts and flip
  `forgotPassword`/`requireEmailVerification` back on in
  components/providers.tsx. Zero-work alternative for launch: disable
  email+password and ship GitHub-OAuth-only. (apps/web/AGENTS.md → Auth)

### Cheap now, expensive after launch

- **Idempotent, version-aware curated seed** — re-running `seed.ts` today
  inserts duplicate `packages` rows (harmless while DB wipes are fine). Once
  curated packages accrue real versions, seed must instead: look up the
  seed-owned package by domain, canonical-hash the version-scoped payload
  (urlPatterns+tools+api+minEngine — `apiContentHash` alone misses tool-only
  changes), no-op on match, insert `max(version)+1` with the JSON's `changelog`
  on change. Then curated updates are edit-JSON + run-seed.
  (apps/web/scripts/seed.ts; packages/schema/src/api-hash.ts)
- **Vercel Preview OAuth smoke test** — Preview now has isolated Neon URLs,
  distinct session secret, GitHub credentials, `BETTER_AUTH_URL`, and shared
  OAuth-proxy settings. Verify a deployed Preview's GitHub sign-in after the
  proxy source change; no live Preview pass is recorded yet.
  (apps/web/lib/auth.ts; apps/web/lib/auth-hosts.ts)
- **`DATABASE_URL_UNPOOLED` is absent from local `.env`** — `drizzle.config.ts`
  prefers it and falls back to the pooled `DATABASE_URL`, so schema migrations
  still run through PgBouncer, silently defeating the point of 7912b61. Absent
  from both the main worktree and fresh workspaces, so `.env.example` should
  list it too. Fix: `neon env pull` (writes both).
  (packages/db/drizzle.config.ts; apps/web/.env.example)
- **Approval-before-publish vs open-publish + moderation** — downgraded by
  local-first installs: once nothing auto-registers, an unreviewed package
  reaches only users who explicitly installed it, so open-publish for tier 1 is
  the answer and a review queue is a tier-2/3 problem. The takedown half is not
  optional and is not here — it is the revocation feed in
  docs/local-first-installs.md §5. What is left for this item: the report path
  (who flags, where it lands) and the tier-2/3 review bar.
  (docs/api-execution-model.md → Open questions)
- **Param-description budget gap** — `inputSchema` property descriptions allow
  1,000 chars vs Chrome's 150 guidance; the removed DOM `fields[]` enforced
  150, API tools bypass it. Align or consciously relax — tightening it after
  strangers publish invalidates stored packages.
  (packages/schema/src/input-schema.ts)
- **`returns` projection for `reddit_comment`** — write output is Reddit's raw
  rendered HTML; project errors/permalink instead. Publish as v2 of the package
  (first exercise of the version-append path — worth proving before strangers
  hit it). (packages/curated-packages/data/reddit.com.json)

## After launch

### Web app

- **Google OAuth** — `socialProviders.google` in apps/web/lib/auth.ts +
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` env (apps/web/.env.example);
  better-auth-ui picks it up automatically. (apps/web/AGENTS.md → Auth)
- **Package search** — search across packages (domain/title/description/
  tool names) in the registry UI; browse is currently domain-filter + pagination
  only. (apps/web/app/api/packages/route.ts GET)
- **Show official webmcps** — surface sites that ship their own first-party
  WebMCP tools (no injection needed) alongside community packages; decide the
  data model (curated list vs. detection) before building.
- **Blog** (low prio) — launch/announcement posts; MDX route group is the
  simple path. Defer until landing + docs exist.

### Extension / executor

- **Fallback `tools=()` policy detection** — the bridge-only in-memory WebMCP
  fallback honors a `false` policy result only when `permissionsPolicy.features()`
  recognizes `tools`; WebMCP-disabled Chromium can report `false` for an unknown
  feature, and browsers may omit the API entirely. Re-test as Chrome's policy
  surface evolves; disable the fallback on that path if a reliable check cannot
  be made. (docs/platform-risks.md → `Permissions-Policy: tools=()`)
- **Move `<all_urls>` to `optional_host_permissions`** — drop the static
  `<all_urls>` content script, request broad access at onboarding (or per-site
  from the popup), register content scripts dynamically via
  `chrome.scripting.registerContentScripts`. One-time refactor that moves every
  future CWS update off the in-depth review queue (fast queue often <1 day vs
  4–5 days) — Google's own chromium-extensions guidance names this the single
  biggest review-time lever. Do after v1 clears review.
  (apps/extension/wxt.config.ts manifest; docs/BACKLOG.md CWS item for the
  review-time research)
- **Chat UI** — embedded chat panel in the extension so users can drive the
  page's WebMCP tools without a terminal agent (today's manual loop uses OpenCode +
  the WebMCP Today MCP local bridge). Needs a design call: model/API-key story, panel
  placement. (apps/extension/AGENTS.md → E2E testing shows the manual loop
  this would replace)
- **MV3 spike for tier-2 script slots** — execute a registry-delivered string
  function under MV3 on GitHub (strict CSP) + Reddit via `chrome.userScripts`
  vs a packaged runner; document permissions friction. Gates tiers 2–3.
  (docs/api-execution-model.md → "MV3 constraints + spike plan", build-order 4)
- **APQ / `persistedQuery` support** — executor currently throws on it; needs
  hash + retry + cross-call cache. Blocks any real GraphQL package (e.g. Reddit
  shreddit search). (packages/engine/src/api-executor.ts TODO;
  docs/api-execution-model.md → "GraphQL support")

### Design questions (need a decision before building)

- **Per-user/per-model output budget** — hard 1.5K truncation removed for v1;
  design the customization (e.g. extension setting) when usage says verbose
  outputs hurt. (docs/DECISIONS.md 2026-07-24 removal entry)
- **Health canary for API packages** — loud failures need a listener; what runs
  it, and how are auth'd writes canaried safely? (docs/api-execution-model.md
  → Open questions)
- **`ctx` composition for tier-2/3** — what slots/scripts receive (auth tokens,
  prior step outputs, endpoint metadata) is under-specified; pin down when the
  executor is built. (docs/api-execution-model.md → Open questions)
