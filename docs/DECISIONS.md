# DECISIONS.md — WebMCP Cafe decision history

Archive of the decisions log formerly kept in `AGENTS.md` (moved 2026-07-24, when the log
outgrew the context file it was living in). **Historical, not normative** — some entries
are superseded by later entries or by current code; trust code + `AGENTS.md` on
disagreement. Significant new decisions may be appended here with a date, but keep them
out of `AGENTS.md` unless they change what an agent must do right now.

- 2026-07-23 — Repo scaffolded on branch `scaffold`; remote `robertn702/webmcp-cafe`
  already existed, so the spec's `gh repo create` step was skipped.
- 2026-07-23 — Lint runs once at the root (`eslint . --max-warnings 0`) instead of
  per-package via turbo; typecheck/test/build fan out through turbo. Simplicity bias.
- 2026-07-23 — Spec says to confirm the extension-spike site list with Robert; running
  autonomously, chose read-only configs for: Hacker News, GitHub, Wikipedia, MDN, npm.
  Swap freely if Robert prefers others.
- 2026-07-23 — better-auth resolved to 1.6.x, where the apiKey plugin moved to the
  scoped package `@better-auth/api-key` (server: root export; client: `/client`).
- 2026-07-23 — Spike UI is plain Tailwind; shadcn/ui CLI adoption deferred until the UI
  grows (stack default stands — don't hand-roll complex components later).
- 2026-07-23 — Verification v1 policy: any signed-in user except the contributor can
  verify a tool, freezing a snapshot served to non-yolo consumers. Editing tools
  cascade-deletes snapshots, so edits always reset verification. Multi-reviewer later.
- 2026-07-23 — CI gate is typecheck + lint + test. `bun run build` of apps/web needs
  real env vars (t3-env validates at build); verified green with dummy values.
- 2026-07-23 — Added root `LICENSE` (MIT, © Robert Niimi) with an attribution block
  for the ported MIT code from Joakim Selemyr's web-mcp-hub / webmcp-extension. Copied
  the LICENSE into `packages/schema` and `packages/mcp` and added it to each `files`
  array so the published npm tarballs carry it (a root-only LICENSE isn't packed from a
  workspace subdir).
- 2026-07-23 — Fixed a previously unrecorded lint-coverage gap: the root ESLint config
  had only `@eslint/js` + `typescript-eslint` + prettier, so React 19 hooks (apps/web)
  and Next.js/monorepo rules went unchecked. Kept the single root config and wired in
  `eslint-plugin-react-hooks` + `@next/eslint-plugin-next` scoped to `apps/web/**`, and
  `eslint-plugin-turbo` repo-wide. Used react-hooks' classic pair (rules-of-hooks +
  exhaustive-deps) rather than v7's full React-Compiler `recommended` suite (simplicity
  bias — the suite only flagged a benign set-state-in-effect). Turned off
  `@next/next/no-html-link-for-pages` (app-router-only). Declared `DATABASE_URL`,
  `WEBMCP_CAFE_API_URL`, `WEBMCP_CAFE_API_KEY` in turbo.json `globalEnv` to satisfy
  `turbo/no-undeclared-env-vars`.
- 2026-07-23 — Added `.superset/config.json` + `.superset/setup.sh` (chmod +x) so fresh
  Superset worktrees self-provision: copies `.env*` (incl. apps/web/.env) and
  `.claude/settings.local.json` from the main worktree, symlinks `.scratch/shared`, and
  runs `bun install`. Modeled on nexus's setup.sh.
- 2026-07-23 — Symlinked `CLAUDE.md -> AGENTS.md` (nexus pattern) so CLAUDE.md-only
  tooling reads the same guidance.
- 2026-07-23 — Added husky + lint-staged pre-commit (runbook default, initially skipped):
  eslint + prettier on staged source files, prettier alone on json/md/css/yaml. Hook
  skips gracefully when bun is missing (nexus pattern) — CI remains the hard gate.
  Follow-up same day: ported nexus's CLAUDE.md drift guard into the hook — staging an
  AGENTS.md auto-creates a missing sibling `CLAUDE.md -> AGENTS.md` symlink and warns
  (without clobbering) on a real file or wrong-target symlink. POSIX-only, runs even
  without bun.
- 2026-07-23 — Wired the extension to the registry API (full loop: publish → extension
  serves it). Fetch runs in a new `background.ts` service-worker entrypoint rather than
  the content script — background fetches hit the registry's own origin directly, which
  sidesteps page CSP `connect-src` restrictions entirely instead of relying on
  `host_permissions` to override them. The content script requests configs via
  `browser.runtime.sendMessage`. Base URL is the `WXT_REGISTRY_API_URL` build-time env
  var (WXT/Vite inlines `WXT_`-prefixed vars into `import.meta.env`), defaulting to
  `http://localhost:3000` in code; added it to turbo.json `globalEnv` for the
  `turbo/no-undeclared-env-vars` lint rule. `host_permissions` in `wxt.config.ts` lists
  both the dev and `https://webmcp.cafe` production origins since manifest permissions
  are fixed at build time. The registry response is validated at the boundary with
  `webMcpConfigSchema` from `@robertn702/webmcp-cafe-schema`; any failure (network,
  non-2xx, schema mismatch, or zero configs for the domain) falls back to the bundled
  `configs/` dir, unchanged from the spike. `yolo=true` is never sent — only verified
  configs are requested. Also fixed a latent gap: the extension's `tsconfig.json`
  `include` list didn't pull in `.wxt/wxt.d.ts`, so WXT's generated `ImportMetaEnv`
  ambient type never applied to `tsc --noEmit` for this project's own tsconfig (only
  mattered once code first referenced `import.meta.env`, in `background.ts`).
- 2026-07-23 — Full e2e loop verified live: registry (verified snapshot) → lookup API →
  extension background fetch → content-script `registerTool` → page WebMCP →
  chrome-devtools-mcp → opencode invoked `wiki_summary` and got real article text.
  Enablers: repo-root `opencode.json` registering chrome-devtools-mcp
  (`--browser-url=http://127.0.0.1:9222`, `--category-experimental-webmcp`) and
  `--remote-debugging-port=9222` in the dev browser launch args. The first real
  invocation immediately caught a rotted selector (Wikipedia's Parsoid `<section>`
  DOM) — concrete evidence for the health/canary metadata the schema reserves room
  for. See "Dev workflow gotchas" below.
- 2026-07-23 — Captured the day's dev-workflow lessons as **nested AGENTS.md**
  files (`apps/extension/AGENTS.md`, `apps/web/AGENTS.md`) rather than growing
  the root file: the agents.md convention is nearest-file-wins, so app-specific
  gotchas live next to the code they describe. Root keeps cross-cutting notes +
  pointers. The pre-commit drift guard auto-creates sibling `CLAUDE.md` symlinks
  for Claude Code parity. Also noted the chrome://flags red herring in the
  extension README (command-line features show "Default" there; chrome://version
  is ground truth).
- 2026-07-23 — shadcn/ui adopted in apps/web (supersedes the earlier deferral).
  Init'd with radix base + nova preset (neutral oklch theme); components live in
  `components/ui/`. Dark mode is semantic-token-driven: the existing
  `@custom-variant dark` + inline no-flash `<html>` class script + `ThemeToggle`
  localStorage logic all stay; the shadcn `.dark` CSS-variable block just remaps
  the same `--background`/`--card`/`--foreground`/etc. tokens. Every page was
  refactored from per-component `dark:` variants to semantic tokens
  (`bg-background`, `text-muted-foreground`, `border-border`, etc.) — zero
  `dark:` or `stone-*` classes remain outside `components/ui/`. Theme toggle
  rebuilt as `ToggleGroup` (type="single", outline variant, spacing=0 for
  segmented control). Added `success`/`warning` variants to Badge (green/amber
  via new `--success`/`--warning` CSS vars + `@theme inline` mappings) and a
  `success` variant to Alert for the one-time API-key display. Also added
  `types/react-css-properties.d.ts` — a module augmentation that restores the
  custom-property index signature on `React.CSSProperties` (`--gap` etc.),
  avoiding `as` assertions in shadcn-generated toggle-group (the repo's
  no-`as` lint rule flagged the generated cast). Badge/Button need `"use
client"` despite being presentational — their `Slot` import from the
  `radix-ui` unified package triggers `createContext` at module scope, which
  Next.js App Router rejects in Server Components. lucide-react icons used
  throughout via `data-icon` per the shadcn skill.
- 2026-07-23 — Navbar/theme-toggle compacted. ThemeToggle kept as the existing
  shadcn `ToggleGroup` (no new components — simplicity bias) but segments are
  now icon-only (Sun/Moon/Monitor, `aria-label` + `title` on each item,
  `aria-label="Theme"` on the group); the theme mechanism (localStorage key,
  inline no-flash script, system listener) is unchanged. layout.tsx nav now
  wraps links + toggle into a `justify-between` group: single row on desktop,
  wraps to a second left-aligned row under the brand at narrow widths (~400px)
  instead of clipping. Shared link styling extracted to a `navLinkClass`
  const. Note: the ToggleGroup `data-state=on` `bg-muted` selected state is
  very subtle in light mode (shadcn default, pre-existing) — visible in
  dark mode, faint against white in light.
- 2026-07-24 — Navbar identity affordance (design Option A of three wireframed):
  new `components/account-menu.tsx` client island in the root layout nav, right of
  the ThemeToggle. `authClient.useSession()` drives three states: Skeleton circle
  while pending (also what SSR emits), a "Sign in" button (GitHub OAuth) when
  logged out, and an Avatar (GitHub `user.image`, initials fallback) opening a
  dropdown-menu (name header + Settings + Sign out only — deliberately NO
  Settings item in the nav itself; /settings is an authenticated-only page,
  and the logged-out sign-in flow is covered by the nav's Sign in button, so
  the old Settings nav link was removed entirely rather than made
  auth-dependent). Added shadcn `avatar` + `dropdown-menu`. ThemeToggle
  untouched; the narrow-width flex-wrap behavior is unchanged.
- 2026-07-24 — Fixed the apikey table to match the `@better-auth/api-key`
  1.6.25 plugin schema: `user_id` renamed to `reference_id` and `config_id`
  added (`text not null default 'default'`). The plugin 500s
  (`field "referenceId" does not exist`) on any api-key endpoint otherwise.
  Migrations 0001 (rename + add column) and 0002 (FK constraint rename to
  `apikey_reference_id_user_id_fk`) applied to Neon; table was empty, no data
  migration needed. Note: drizzle-kit `generate` prompts interactively for
  column renames (needs a TTY) — used `generate --custom` + hand-filled SQL
  instead. Any worktree running pre-rename code against the migrated DB will
  500 on /settings API keys until it picks up this change.
- 2026-07-24 — Auth UI migrated to better-auth-ui (shadcn registry: `auth`,
  `settings`, `user-button`, `api-key` + `sonner`). Replaces the hand-rolled
  `AccountMenu`/`api-keys.tsx` with vendored components under
  `components/auth/`. New routes: `/auth/[path]` (dedicated sign-in/sign-out;
  `AuthProvider` sets `emailAndPassword.enabled: false`, so password views
  redirect to the social-only sign-in) and `/settings/[path]` (account +
  security tabs; `/settings` redirects to `/settings/account`). `/settings/*`
  is now gated server-side via `ensureSession` + `HydrationBoundary` (no more
  client-side auth flash); `Settings` also calls `useAuthenticate` for
  reactive sign-out. Navbar uses `<UserButton size="icon" />`. Key learnings:
  (1) `useAuth().authClient` is typed as the _base_ better-auth client, so
  plugin-typed hooks (`useListApiKeys`, `useSetActiveSession`) can't be fed
  from context without casts — vendored components import the app's typed
  `@/lib/auth-client` directly instead, which keeps the no-`as` rule intact
  (upstream uses `as` widenings here). (2) `auth-client.ts` registers
  `usernameClient()` + `multiSessionClient()` purely as type-level enablers
  for those hooks (`displayUsername` etc.); the server runs neither plugin.
  (3) ~30 upstream `as` assertions were rewritten to narrowing
  (`e.currentTarget`, `formString` helpers in `lib/form-data.ts`,
  `Reflect.get`, type predicates, an `AdditionalFieldRegister` render
  augmentation in `components/auth/auth-provider.tsx`) — expect conflicts to
  re-appear on registry re-syncs. (4) Organization-owned API keys are
  deliberately not wired (no org plugin server-side);
  `organization-api-keys.tsx` was dropped from the vendored set. (5) The
  shadcn `sonner` component's next-themes dependency was removed —
  `components/ui/sonner.tsx` observes the `.dark` class on `<html>` to match
  the repo's existing theme mechanism.
- 2026-07-24 — Replaced the per-tool verification model with the package-install model
  (`docs/erd.md`, decisions in `.scratch/erd-proposal.md`, not committed). Dropped
  `configs`/`tools`/`verification_snapshots`/`votes` and `yolo` everywhere; added
  `webmcp_definitions` / `definition_versions` (append-only) / `installs` (auth-only,
  doubles as the derived trust signal). `packages/schema`'s `urlPattern` (single
  domain-relative string) became `urlPatterns` (string array, Chrome `@match`-style
  `scheme://host/path`); `url-matching.ts` was rewritten around that format and
  `rankConfigsByUrl` dropped its `domain` param (patterns are self-contained). Migration
  `packages/db/migrations/0003_webmcp_erd_redesign.sql` was hand-written (drizzle-kit
  `generate --custom`) — the meta snapshot was also hand-authored (see the file's git
  history) because `--custom` migrations don't diff schema.ts, so `generate --custom`
  alone leaves the snapshot stale for the _next_ `generate`; verified by rerunning plain
  `generate` afterward and confirming "No schema changes, nothing to migrate". Endpoints:
  `POST /api/configs` (new definition + v1), `POST /api/configs/:id/versions` (append a
  version, owner-only), `PATCH /api/configs/:id` (metadata only, never touches
  versions), `POST`/`DELETE /api/configs/:id/install`, `POST /api/configs/:id/update`
  (move an install's pin; also rollback), `GET /api/configs/lookup?url=&installed=true`
  (authenticated variant serving the caller's pinned versions). Deleted
  `verify`/`vote` routes and the `VerifyButton`/`VoteButtons` components; added
  `InstallButton`. `packages/mcp` write tools follow the same split (`upload_config`,
  `update_config_meta`, `publish_config_version`, `install_config`/`uninstall_config`/
  `update_config_install`). Public API route paths under `/api/configs/*` were kept
  as-is even though the underlying tables renamed — renaming the path is a follow-up.
- 2026-07-24 — Enabled email/password auth alongside GitHub OAuth (branch
  `login-email-support`). Two-line change: `emailAndPassword: { enabled: true }`
  in `apps/web/lib/auth.ts` and `emailAndPassword={{ enabled: true,
forgotPassword: false }}` in `providers.tsx` — the vendored better-auth-ui
  components adapt entirely off the `emailAndPassword` context (sign-in form,
  sign-up view, ChangeEmail/ChangePassword in settings). No migration: the
  `account` table already had the `password` column. No email sender is
  configured, so forgot/reset-password is hidden in the UI and email
  verification is not required; adding an email provider later means setting
  `emailAndPassword.sendResetPassword` server-side and flipping
  `forgotPassword`/`requireEmailVerification` back on. Follow-up fix: the
  settings components' `onInvalid` handlers read `e.currentTarget` inside
  `setState` updaters, which crash (`currentTarget` is null by the time the
  updater runs) — capture `validationMessage` in a local first, matching the
  `const el = e.currentTarget` pattern already used in the sign-in/sign-up
  forms.
- 2026-07-24 — Stale-docs sweep after the package-install redesign + leaderboard
  removal: rewrote the README REST API section (lookup `installed=true`,
  versions/install/update endpoints; no more `yolo`/verify/vote), rewrote the
  extension README's full-loop test (publishing is immediately servable — no
  verify step; API keys at `/settings/security`; sign-in at `/auth/sign-in`),
  fixed the pending initial-release changeset's MCP tool list, and bannered
  `SPEC.md` as historical/non-normative rather than rewriting it (code +
  AGENTS.md win on disagreement).
- 2026-07-24 — Added a "Status: PRE-PRODUCTION" section up top: the app isn't
  deployed, production-grade caution (data-preserving migrations, API backwards
  compat) is wasted effort, and DB wipes/resets are always fine — iterate fast
  until launch. The section instructs agents to update it when we do ship to
  production.
- 2026-07-24 — Reworked `minEngine`: (A) semver string → positive integer capability
  level (`engineLevelSchema` in `packages/schema/src/config.ts`), compared with plain
  `>=` against `ENGINE_VERSION` in `budgets.ts` — the format has no patch releases, so
  semver's extra dimensions were meaningless; (B) moved from `webmcp_definitions`
  (mutable metadata) to `definition_versions` (append-only) — engine requirements are
  a property of a version's content (e.g. a version adding the `api` block needs a
  higher level than a DOM-only version), so a user pinned to an older version must not
  be told their engine is too old because of a newer version's requirements.
  `updateDefinitionMetaSchema` now omits `minEngine`; `publishVersionSchema` picks it
  alongside `urlPatterns`/`tools`/`api`/`changelog`. Removed `semverSchema` and
  `SCHEMA_VERSION` (the latter was unused outside `packages/schema` and only ever
  described the old semver shape). Migration `0004_min_engine_to_versions.sql`
  (hand-written via `generate --custom` + hand-edited meta snapshot, same recipe as 0003) carries over any existing `webmcp_definitions.min_engine` semver text onto all
  of that definition's versions by casting the leading major-version digits to an
  integer (`'1.0.0'` → `1`); applied clean to the dev DB (no rows had a value set, so
  it was a no-op in practice). No engine-enforcement logic was added — the extension
  still doesn't check `minEngine` at all; that's a later step.
- 2026-07-24 — Authored the Reddit flagship config
  (`apps/extension/configs/reddit.com.json`, build-order step 3 in
  docs/api-execution-model.md): 6 tier-1 tools — `reddit_me`,
  `reddit_subreddit_hot`, `reddit_search`, `reddit_read_thread` (reads) +
  `reddit_comment`, `reddit_vote` (writes via the modhash CSRF flow;
  `reddit_comment` sets `destructiveHint` for the executor's confirm gate).
  No GraphQL endpoint: the executor throws on `persistedQuery` (APQ
  unimplemented), and a fabricated shreddit document would fail against the
  real backend — REST `/search.json` covers search instead. Found and fixed a
  persistence gap: `definition_versions` had no `api` column, so publishing a
  tier-1 config through the API/seed would have silently dropped the api block
  — added `api jsonb` (migration `0005_complete_living_lightning.sql`, a plain
  non-interactive `drizzle-kit generate` since it's a pure ADD COLUMN) and
  wired it through `mutations.ts` (both inserts), `serialize.ts`, and
  `seed.ts`. Bumped `ENGINE_VERSION` to 2 (the api block changed the format's
  shape; config sets `minEngine: 2`). Extended the `returns` projection
  grammar with `{a,b,c}` field pickers (maps over arrays) — without it, one
  Reddit listing item blows the 1.5K output budget and every read tool
  truncates mid-JSON. Gotcha: `packages/schema` resolves via `dist/`, so a
  stale build surfaces as bizarre validation errors (e.g. `minEngine` reported
  as a string) — `bun run build` in packages/schema first when schema changes
  don't seem to apply. Reddit config seeded into the dev DB via a one-off
  insert (full seed would duplicate the existing five definitions).
- 2026-07-24 — Restructured root `AGENTS.md` per the `agents-md` skill
  (getsentry/skills, installed project-locally to enforce the standard): moved
  the dated decisions log into this file, distilled still-true facts into
  topical sections, 377 → 100 lines (the skill's hard max). Going forward:
  append significant decisions here, not to `AGENTS.md`, unless they change
  what an agent must do right now.
- 2026-07-24 — Full tier-1 e2e verified live on reddit.com: all six Reddit
  tools invoked through the real loop (registry lookup → background fetch →
  content-script `registerTool` → chrome-devtools-mcp `execute_webmcp_tool`).
  Reads returned field-picked data under budget; `reddit_vote` exercised the
  modhash CSRF flow (upvoted + cleared, no trace); `reddit_comment` posted to
  r/test (`t1_ozj5npb`, left in place) and proved the `destructiveHint` gate
  genuinely blocks the write on `window.confirm` until the user approves.
  Driven via `packages/mcp/.scratch/*.mjs` (MCP-over-stdio wrapper for
  chrome-devtools-mcp — an opencode session doesn't always have that server
  loaded). Learnings: (1) the config-source log line is emitted by the content
  script, so it appears in the **page console**, not the service worker
  (nested AGENTS.md corrected); (2) invoking a gated tool via
  chrome-devtools-mcp surfaces an "open dialog" notice — a human must handle
  the confirm in the browser before the write fires; (3) `reddit.com.json` is
  deliberately absent from the bundled fallback, so on reddit.com _silence_
  (no log line, no tools) is the registry-failure signal; (4) the comment
  endpoint has no `returns` projection, so write output is Reddit's raw
  rendered HTML truncated at budget — candidate for a minimal `returns`
  (errors/permalink) later; (5) listing reads clip the last item around
  5 × ~300 chars — agents should pass limit 3–4.
- 2026-07-24 — Removed the tool-output character cap entirely for v1. The
  executors previously truncated every result to 1.5K chars (`TOOL_OUTPUT_MAX`
  in `packages/schema/src/budgets.ts`, applied in `mcpResult`); that export and
  the truncation are gone — `mcpResult` now returns text as-is. Rationale: the
  right output budget is model-dependent (a 1M-context model should be far less
  conservative than a 256K one), and Chrome's 1.5K is guidance, not an enforced
  limit — so a single hard cap was the wrong default and was silently clipping
  read tools mid-JSON. Verbose output is acceptable for v1. The publish-time
  metadata caps (`TOOL_NAME_MAX` 30, `TOOL_DESCRIPTION_MAX` 500,
  `PARAM_DESCRIPTION_MAX` 150) are untouched and stay hard. The `returns`
  projection stays valuable for output density/relevance, just no longer for
  fitting a fixed budget. Follow-up: design output-budget customization later
  (e.g. a per-user extension setting for output budget, possibly model-aware);
  the budget question is deferred, not answered.
- 2026-07-24 — Surveyed the reference implementation now that it ships as a
  product: **WebMCP Hub** (Joakim Selemyr — the same MIT source our DOM executor
  is ported from) is **published on the Chrome Web Store**
  (`ahblgfajboifhioeldnefolijmllkaaj`, v1.0.0, 19 Feb 2026, 21 users, 21.8 KiB,
  "will not collect or use your data"). Four findings bear on our launch.
  (1) **The WebMCP flag is unavoidable for end users.** Their README lists
  Chrome Canary/Dev + `chrome://flags` "WebMCP for testing" + the Model Context
  Tool Inspector as prerequisites — they push enablement onto the user rather
  than solving it, and no origin-trial path exists for us either: we inject into
  third-party sites, which never serve a trial token on our behalf. So the
  extension must detect a missing `document.modelContext` /
  `navigator.modelContext` and say how to turn it on, and the install page leads
  with that copy. (2) **Store approval is precedented for this exact category** —
  remote-registry lookup plus content-script tool registration passed review.
  Our policy position is stronger than theirs: no `evaluate` step, and we ship
  declarative JSON interpreted by a bundled executor, not code. Say precisely
  that in the listing and make the same no-data-collection declaration; the
  "no remote code" fight stays where `docs/api-execution-model.md` puts it, at
  tiers 2–3. (3) **SPA fix shape**: their listing claims both traditional loads
  and SPAs because the background script listens for navigations and looks up
  configs per navigation — versus our once-at-`document_idle` content script.
  (4) Their popup exposes a **configurable hub URL**, so a store-approved
  extension can already be pointed at an arbitrary registry; if our
  `GET /api/configs/lookup` is wire-compatible with their hub client, that is a
  launch path with zero store-review latency, at the cost of shipping our
  experience inside a competitor's shell — worth a short compatibility check.
  Strategic read: 21 users in five months says the reachable audience today is
  people willing to run a Chrome flag, i.e. developers. Launch to them (config
  authoring docs, the schema/MCP packages, honest "this is early" framing)
  rather than polishing for a consumer audience that cannot run the API yet.
- 2026-07-24 — Platform-risk assessment, now living in docs/platform-risks.md.
  The origin-isolation fear in SPEC.md was obsolete: Chrome defaults to
  origin-keyed agent clusters since the `document.domain` deprecation (~M115),
  so only legacy `Origin-Agent-Cluster: ?0` sites fail. The real upstream risks
  are unsanctioned extension-side registration (webmachinelearning/webmcp#74 —
  tail risk is provenance marking, not blocking, since gating `registerTool`
  buys the platform nothing over what `host_permission` already grants) and
  `Permissions-Policy: tools=()` as a per-site kill switch (#178 — enforced
  above the JS layer, and the filer is advocating it as standard defensive
  posture with a demo that is exactly our injection pattern). Decided: if a
  site sends `tools=()`, we respect it — catch the SecurityError, mark the
  config site-blocked, do NOT strip the header via declarativeNetRequest. It
  removes a user-protection control for all scripts, invites CWS rejection,
  and the platform sides with the site if it escalates. The trend to watch is
  `tools=()` becoming baseline guidance or a framework/CDN default — that
  version is existential, the header alone is not. Fallback for both risks is
  the same: the DOM executor doesn't need WebMCP as transport, so the product
  degrades to extension-mediated agent access (side panel / chrome.debugger
  WebMCP CDP domain), a different shape rather than a dead one.
- 2026-07-24 — Two launch-blocking extension gaps closed: **WebMCP-flag onboarding**
  and **re-registration on SPA navigation**. Design calls worth keeping.
  (1) **Order**: configs are now looked up _before_ `getModelContext()` is probed.
  The probe used to come first, so "the flag is off" was indistinguishable from
  "nothing to inject here" — and warning on the probe alone would fire on every
  page on the internet. The signal now fires only once a config has matched.
  (2) **Surface**: the extension's own surfaces, never the page. A `console.warn`
  in the page console (where the rest of the extension's logging goes) carries the
  exact steps, and a new popup entrypoint + action badge carry them where a
  non-developer will actually see them: `!` badge when a config matched but WebMCP
  is missing, tool count when registration worked, cleared otherwise. Page-injected
  banners on third-party sites were rejected as user-hostile and a CWS-review risk.
  No new permissions — the badge rides on the `action` key the popup adds, and the
  flag URL is rendered as selectable text rather than a copy button so we don't ask
  for `clipboardWrite`. Per-tab status lives in an in-memory Map in the background
  worker; a worker restart loses it and the popup then says "reload the page",
  while the badge (per-tab browser state) survives independently — accepted over
  paying for the `storage` permission.
  (3) **SPA detection lives in the content script, not the background.** Hub does
  per-navigation lookup from the background via webNavigation; we already ask the
  background per lookup, and the pass's AbortController state belongs next to the
  registrations, so a content-script watcher was the smaller change — and it avoids
  the "read your browsing history" permission warning `chrome.webNavigation` would
  add to the store listing. Detection is `popstate` + `hashchange` plus a 500 ms
  `location.href` poll. The poll is load-bearing, not laziness: `history.pushState`
  is the common SPA route change and a content script **cannot** observe it —
  patching `history` from the isolated world only intercepts the isolated world's
  own calls. Cost: up to ~500 ms where the previous route's tools are still the
  registered ones. The Navigation API (`navigatesuccess`) was skipped rather than
  added as a fast path, because whether it fires for an isolated world couldn't be
  verified here.
  (4) **Teardown by signal**: one `AbortController` per pass, passed to
  `registerTool` as `{ signal }` and aborted on the next URL change, so the
  previous route's tools go away with the pass that made them. Passes are
  serialized (a navigation waits for the aborted pass to drain rather than
  interleaving) and an unchanged URL is a no-op.
  (5) Registration moved out of the content-script entrypoint into
  `src/lib/register-tools.ts`, taking its four side effects (config lookup, WebMCP
  probe, site-declared tool names, status reporting) as injected deps — the reason
  the flag-off branch, the stale-tool teardown and the no-op-on-unchanged-URL
  behaviour are unit-tested at all (`test/register-tools.test.ts`,
  `test/navigation.test.ts`). Not verified live: the flag-off path needs a Chrome
  without `#enable-webmcp-testing`, and the SPA path needs a human driving the dev
  browser.
- 2026-07-25 — Relicensed as a split, superseding the 2026-07-23 root-`LICENSE` (MIT)
  entry above: the server (`apps/web`, `packages/db`) is now **AGPL-3.0-only** — root
  `LICENSE` is the verbatim FSF text under a short scope header — while the
  adoption-surface packages stay **MIT**, each with its own `LICENSE`:
  `packages/schema`, `packages/mcp` (both already had one) and `packages/definitions`,
  `apps/extension` (added now). Rationale: start open, but keep the option to sell a
  hosted/commercial server later. The Joakim Selemyr attribution block therefore moved
  off the root LICENSE and lives only where the ported MIT code actually is —
  `packages/schema/LICENSE` (`config.ts`, `steps.ts`, `fields.ts`, `derive-schema.ts`)
  and `apps/extension/LICENSE` (`src/lib/` executor); `packages/definitions` has no
  ported code and omits it, and the AGPL'd tree contains none. Contributions are
  covered by a new `CONTRIBUTING.md` CLA: an irrevocable, non-exclusive license to
  relicense under any terms (plus patent grant) rather than copyright assignment —
  contributors keep their copyright, and the relicensing option survives without
  chasing them. Git history was deliberately NOT rewritten; the MIT-era commits are
  inert because the repo was never distributed.
- 2026-07-25 — **Installed packages move into the extension's `chrome.storage.local`.
  No account to consume; auth only to publish.** Design: `docs/local-first-installs.md`
  (decided, unimplemented — the code, `ARCHITECTURE.md`, `docs/erd.md` and
  `mode-flows.ts` all still describe the current design until each step lands). What
  forced it: the extension sends every full URL it sees to `GET /api/configs/lookup`
  (`content.ts:10` matches `<all_urls>`, `navigation.ts:36` polls every 500 ms), so the
  registry receives a browsing-history feed — and the lookup's default branch has no
  auth and serves latest-version configs to anyone (`lookup/route.ts:24`), so **install
  has never affected what registers**. Both landing TrustFacts about seeing tools first
  and pinned versions (`page.tsx:194`, `:198`) were false as built; local installs make
  them true by construction. Supersedes the backlog's "factor in installed configs" fix
  (credentialed `installed=true` fetch): that keeps the URL feed and makes consumption
  require an account, which is the opposite of the direction chosen. Consequences worth
  knowing without opening the doc: the bundled auto-registering fallback is deleted and
  becomes a first-run **suggestion** list (same consent gap in miniature), which also
  ends the silent-fallback trap and voids the reddit-exclusion debugging convention;
  a revocation feed (`GET /api/revocations?since=`) is **mandatory**, because once
  bodies live on disk it is the registry's only remaining lever after install; install
  count is dropped as a trust signal (anonymous consumption makes it inflatable, and no
  code path ever ranked by it — `url-matching.ts:151`, `lookup.ts:33`,
  `configs-repo.ts:84`); the MCP install tools keep their names but stop claiming a
  browser effect and hand back a deep link the human clicks. Dropping the `<all_urls>`
  content script for per-domain `optional_host_permissions` +
  `chrome.scripting.registerContentScripts` was researched against current MV3 docs and
  **works**, with two hard constraints: `permissions.request()` needs a user gesture in
  an extension surface (unavailable in content scripts, lost when forwarded through the
  service worker — crbug.com/1284891), so a grant always ends in the popup; and reading
  tab URLs from the background costs `tabs`/`webNavigation`, both warned as "Read your
  browsing history", so discovery uses warning-free `declarativeContent` rules instead
  and gives up badge _text_ on non-installed sites. Sequenced last, not first — consent
  is fixed by local installs alone. Cross-device sync and signed-in install state are
  explicitly deferred and were not allowed to shape v1.
- 2026-07-25 — **Terms of service + config submission terms** (`/terms`, `apps/web`).
  The repo licensing split that landed the same day covers _code_; community-submitted
  configs had no terms at all, so the project had no stated right to host or redistribute
  the corpus and no consumer had a stated right to use it. Closed with a ToS rather than a
  license field, which is how npm, PyPI and Greasy Fork all handle submitted content.
  Three parts: (1) an **inbound grant** — publishing grants a worldwide, non-exclusive,
  irrevocable, perpetual, royalty-free, sublicensable license to host/reproduce/modify/
  redistribute, plus a warranty that the submitter has the right to submit; irrevocable is
  load-bearing because versions are append-only and installs pin, so a revoked grant would
  break live installs. (2) an **outbound corpus license of CC0** — MIT's notice-retention
  clause is unworkable on a JSON blob injected into a live page, so it would be decorative;
  `packages/definitions` stays MIT because it is code-shaped and ships its own LICENSE.
  (3) **notice at the point of submission on both surfaces** — a line on the publish button
  for the form, and for the API a `terms` field + `Link: …; rel="terms-of-service"` header
  on every `201` (`acceptedSubmission` in `apps/web/lib/http.ts`), since an agent POSTing
  never sees `/submit`. Deliberately _not_ done: a per-config `license` field on
  `packages/schema` (one blanket license for v1), and a `agreeToTerms` checkbox/field —
  a required schema field would break the seed corpus and every published consumer, and the
  button-adjacent notice is the pattern npm and GitHub use. The document is an unreviewed
  draft: no governing-law or dispute clause (inventing a jurisdiction is worse than omitting
  one) and the only contact channel is the public issue tracker, because no mail provider is
  configured yet. Both gaps are marked `TODO(legal)` in the page.
- 2026-07-26 — **`revocations.id` is a `bigserial`, not the repo's usual random uuid.**
  Every other PK in `packages/db` is `uuid().defaultRandom()` (`webmcp-schema.ts:23`,
  `:46`), but this id doubles as the client's poll cursor
  (`GET /api/revocations?since=<cursor>`, `WHERE id > cursor`) and a random uuid is not
  monotonic, so it cannot mean "everything I have not seen". Knock-ons: `?since=` and
  `revocationEntrySchema.id` are numbers rather than uuid strings, and the feed is served
  **ascending** so a capped page is a contiguous prefix of the unseen tail instead of a
  newest-first slice that would strand entries behind an advanced cursor.
- 2026-07-26 — **The revocation wire schemas live in `packages/schema/src/registry.ts`**
  (`revocationEntrySchema`, `revocationsResponseSchema`). `docs/local-first-installs.md` §5
  specifies the endpoint but never says where its types live; `packages/schema` is the only
  module `apps/web` and `apps/extension` both reach — the extension already depends on it
  and already validates network responses against it (`registry-client.ts:2`), which is the
  same discipline a feed that can disable installed packages needs. The consequence the
  design's step-2 blast-radius line ("Additive") omits: `packages/schema` is **published**,
  so the revocation read path is a published-package change and needs a changeset.
- 2026-07-26 — **A client must complete one successful revocation poll before any package
  becomes registerable** — `docs/local-first-installs.md` design gap 4, resolved
  fail-closed on first run. §5's fail-safe ("a failed poll leaves the last known list in
  place", `:241-242`) silently assumes a previous list exists. On a fresh client "fetch
  failed" and "fetched, zero revocations" are indistinguishable, so as written it registers
  everything — backwards for exactly the case revocation exists to cover. Because a package
  can only enter storage via a successful registry fetch (step 4's `install.ts`), requiring
  the first revocation fetch on that same path makes "has packages but has never polled"
  unreachable, and every later poll keeps the documented friendly fail-safe: stale but
  restrictive, never re-enabling. Precedent: OCSP soft-fail versus Chrome's CRLSets — OCSP's
  flaw was not the concept but failing open under a network condition the attacker controls.
  **Recorded now, implemented at step 4** — not in the PR that records it.
- 2026-07-26 — **Auth tables renamed to plural snake_case in SQL; drizzle export names
  stay singular.** `user|session|account|verification|apikey` became
  `users|sessions|accounts|verifications|api_keys` as Postgres table names, matching the
  app-owned tables (`webmcp_definitions`, `installs`, …). The two names are independent:
  better-auth resolves models by a plain `schema[model]` property read against
  `packages/db/src/index.ts`'s `schema` object (`@better-auth/drizzle-adapter` `getSchema`),
  and the api-key plugin hardcodes its model as `apikey` (`API_KEY_TABLE_NAME`), so the
  **export** names are load-bearing and stay singular; the `pgTable()` first argument is
  drizzle's alone and better-auth never sees it. Rejected `usePlural: true`, which naively
  appends `s` (`@better-auth/core` `get-model-name.mjs`) and so yields `apikeys` — not
  snake_case, and it would have pinned the export names too. Also rejected per-model
  `modelName` overrides (core `BetterAuthDBOptions.modelName` + the plugin's `schema`
  option): five more config surfaces to hand-sync, and they drift every time
  `@better-auth/cli generate` runs. Extra motive for `user` specifically: it's a reserved
  word in Postgres, so `SELECT * FROM user` is a syntax error unquoted — relevant because
  revocation writes are hand-run SQL in v1. Migrations 0000–0006 were squashed into a
  single `0000_init.sql` rather than stacking a rename migration (pre-production, DB is
  wiped and re-migrated; also sidesteps drizzle-kit's interactive rename prompt).
