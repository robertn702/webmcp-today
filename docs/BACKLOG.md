# Backlog

Open follow-ups, grouped by post-launch scope then roughly next-first. One line per
item — detail lives at the linked doc, not here. Rules: an item with no pointer
to detail gets deleted on sight; whoever completes an item deletes it in the
same PR. Not a wishlist.

**Initial release =** public `webmcp.today` beta for a developer audience — the
extension's local bridge fallback works without the WebMCP testing flag; Chrome's
native agent remains flag/origin-trial gated through Chrome 156. Tier-1 packages
only; install the extension from the public release ZIP.

## Post-launch follow-ups

### Distribution and account access

- **Chrome Web Store distribution** — do not assume approval. The public release
  ZIP remains the documented installation path. If pursuing Store distribution,
  verify the current submission state with the owner before changing public copy.
  The `<all_urls>` content script may trigger in-depth review. Hub's popup can
  target `GET /api/packages/lookup`, which is a fallback worth a compatibility
  check if Store distribution remains blocked. The tiers 2–3 "no remote code"
  answer can follow later. (docs/DECISIONS.md 2026-07-24 Hub survey;
  docs/api-execution-model.md → Open questions)
- **Email service** (password reset, verification) — email/password signup exists,
  but no recovery or verification sender is configured; GitHub OAuth is available
  alongside it. Pick a provider when email/password recovery or verification is needed
  (needs Robert: Resend/Postmark/SES + env creds), then set
  `emailAndPassword.sendResetPassword` in apps/web/lib/auth.ts and flip
  `forgotPassword`/`requireEmailVerification` back on in
  components/providers.tsx. (apps/web/AGENTS.md → Auth)

### Cheap now, expensive later

- **Idempotent, version-aware curated seed** — re-running `seed.ts` today
  inserts duplicate `packages` rows. Before using it against production data,
  seed must instead: look up the
  seed-owned package by domain, content-hash the version-scoped payload
  (urlPatterns+tools+api+minEngine — a hash over `api` alone would miss
  tool-only changes), no-op on match, insert `max(version)+1` with the JSON's
  `changelog` on change. Then curated updates are edit-JSON + run-seed.
  (apps/web/scripts/seed.ts)
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
- **`returns` projection for `reddit_comment`** — write output is Reddit's raw
  rendered HTML; project errors/permalink instead. Publish as v2 of the package
  (first exercise of the version-append path — worth proving before strangers
  hit it). (packages/curated-packages/data/reddit.com.json)

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
  `chrome.scripting.registerContentScripts`. This reduces the known broad-host-
  permission review trigger but does not guarantee a particular CWS queue outcome.
  Do this only if pursuing Store distribution. (apps/extension/wxt.config.ts manifest)
- **Chat UI** — embedded chat panel in the extension so users can drive the
  page's WebMCP tools without a terminal agent (today's manual loop uses OpenCode +
  the WebMCP Today MCP local bridge). Needs a design call: model/API-key story, panel
  placement. (apps/extension/AGENTS.md → E2E testing shows the manual loop
  this would replace)
- **MV3 spike for tier-2 script slots** — execute a registry-delivered string
  function under MV3 on GitHub (strict CSP) + Reddit via `chrome.userScripts`
  vs a packaged runner; document permissions friction. Gates tiers 2–3.
  (docs/api-execution-model.md → "MV3 constraints + spike plan", build-order 4)
- **APQ support** — no accepted schema field for it today; adding it means a new
  field (e.g. a `persistedQuery` endpoint flag) plus hash + retry + cross-call
  cache in the executor. Blocks any real GraphQL package (e.g. Reddit shreddit
  search). (docs/api-execution-model.md → "GraphQL support")

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
