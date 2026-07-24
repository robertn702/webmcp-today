# AGENTS.md — WebMCP Cafe

Working notes for agents building this repo. Full handoff brief: `SPEC.md` (read it first).

## What this is

**WebMCP Cafe** (`webmcp.cafe`) — a community registry of third-party **WebMCP tool
configs** injected into sites that haven't implemented WebMCP themselves. "Greasyfork for
the agentic web": declarative configs teach AI agents to operate a site; an extension (or
MCP server) delivers them. Pitch: **agents teaching agents.**

Reference implementation (MIT, study/port): Joakim Selemyr's
[web-mcp-hub](https://github.com/Joakim-Sael/web-mcp-hub) and
[webmcp-extension](https://github.com/Joakim-Sael/webmcp-extension).

## Layout

```
apps/web/          Next.js — registry UI + public REST API
apps/extension/    WXT — config lookup + tool injection
packages/schema/   @robertn702/webmcp-cafe-schema — zod config format (published)
packages/db/       Drizzle + Neon — schema + client
packages/mcp/      @robertn702/webmcp-cafe-mcp — MCP server (published)
```

`packages/schema` is the keystone — every consumer validates against it.

## Stack (decided — do not relitigate)

Bun + Turborepo, TypeScript strict ESM, Next.js + React 19 + Tailwind 4 + shadcn/ui,
Next route handlers + zod (no tRPC), Neon Postgres + Drizzle, better-auth (GitHub OAuth +
API-key plugin), zod v4, @t3-oss/env, Vitest, ESLint + Prettier, Changesets,
@modelcontextprotocol/sdk.

## Conventions

- **No `as` type assertions** except `as const` (ESLint-enforced via
  `no-restricted-syntax`). Validate at boundaries with zod; narrow with runtime checks.
- Simplicity bias: smallest version that works; no abstraction without a current need.
- Conventional-commit messages, one commit per milestone, keep `main` green:
  `bun run typecheck && bun run lint && bun run test` before every commit.
- Project-local skills live in `.agents/skills/` (installed via `npx skills add`, never
  `-g`). Use `shadcn`, `better-auth-best-practices`, `vercel-react-best-practices`,
  `webmcp-gen`, `webmcp` when working in their domains.

## WebMCP essentials (July 2026)

- Feature-detect: `const mc = document.modelContext ?? navigator.modelContext` (API moved
  to `document` in the 21 Jul 2026 draft; Chrome 150 deprecates `navigator`).
- `await mc.registerTool({ name, description, inputSchema, execute, annotations }, { signal })`
  — Promise-based, rejects on duplicate names. Annotations: `readOnlyHint`,
  `untrustedContentHint`.
- Chrome origin trial 149→156; local dev needs `chrome://flags/#enable-webmcp-testing`.
- Char budgets: 500/tool description, 150/param description, 30/name, 1.5K/tool output.
- **Open question:** WebMCP is gated to origin-isolated documents; whether
  content-script registration keeps working when WebMCP ships stable is unknown. Track
  https://github.com/webmachinelearning/webmcp.

## Config format ground rules

- Based on Joakim's format, extended: `{ domain, urlPatterns[], title, description,
tools[], changelog? }`. `urlPatterns` is Chrome extension `@match`-style
  (`scheme://host/path`, e.g. `*://*.wikipedia.org/wiki/*`), versioned alongside `tools`
  — see "Registry data model" below. Tool `execution` is simple mode
  (fields/autosubmit/resultSelector) or multi-step
  (`navigate | click | fill | select | wait | extract | scroll | condition`).
- **No `evaluate` step in v1** (arbitrary code execution in the user's logged-in page).
- `minEngine` field so the format can evolve.
- Extension must skip + warn on tool-name collision with site-registered tools.

## Registry data model (package-install model, replaces per-tool verification)

- Trust = install count, not per-tool verification. Three tables: `webmcp_definitions`
  (mutable metadata), `definition_versions` (append-only: urlPatterns + tools +
  changelog), `installs` (auth-only, pins a user to a version; doubles as the trust
  signal via `COUNT ... GROUP BY`). Full diagram + reading notes: `docs/erd.md`.
- **Served truth is `definition_versions` rows directly** — no snapshot table. Browse and
  fresh (`GET /api/configs/lookup`) serve each definition's latest version. Installed
  users stay pinned to `installs.version_id` (npm-style, user-initiated updates) until
  they call the update endpoint; rollback is just moving the pin back.
- **No `(domain, url_pattern)` uniqueness by design** — rival packages may target the
  same site; install counts + pattern specificity rank them, not a first-come
  registration.

## Credentials Robert must supply (placeholders in `.env.example`)

- `DATABASE_URL` (Neon), `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` (OAuth app),
  `BETTER_AUTH_SECRET`. Vercel deploy + Chrome Web Store come later.

## Decisions log

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

## Dev workflow gotchas

Hard-won on 2026-07-23; check the **nested AGENTS.md** files before debugging
"haunted" dev behavior — app-specific detail lives next to the code
(nearest-file-wins, per the agents.md convention; sibling `CLAUDE.md` symlinks
are auto-created by the pre-commit hook):

- `apps/extension/AGENTS.md` — one-dev-instance rule (Chrome profile lock,
  corrupted `.output/`), silent-fallback trap (registry vs bundled log line),
  selector-rot debugging recipe, dev-browser flags/ports.
- `apps/web/AGENTS.md` — served truth is `definition_versions` at latest version
  (or the caller's `installs.version_id` pin), seeds start with zero installs, env
  requirements.

Cross-cutting: ports are web 3000 / wxt 5173 / CDP 9222; find strays with
`lsof -nP -i :3000 -i :5173 -i :9222`; killing a bun wrapper does NOT kill its
node child.
