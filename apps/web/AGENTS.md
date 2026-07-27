# AGENTS.md — apps/web

Registry web app + REST API. Repo-wide guidance: root `AGENTS.md` (read it first).

## Routes

- `app/page.tsx` is the **public landing page** — full-bleed, outside any container.
  Its two staged diagrams are derived from `ARCHITECTURE.md`'s runtime/data flow
  sequences (`components/landing/mode-flows.ts`); if those flows change, change the copy.
- Everything else lives in the `app/(registry)/` route group, whose layout supplies the
  shared `max-w-5xl` container. Route groups don't affect URLs — `/packages`, `/submit`,
  `/settings`, `/auth` are unchanged. Browse is `/packages` (it used to be `/`).
- `/extension` is a stub until the extension is published; the landing CTA points at it
  and both carry a `TODO(extension)` marker for the Web Store swap.
- `components/site-footer.tsx` renders once from the **root** layout (not the registry
  group), so `/terms` and the AGPL §13 source offer appear on the landing page too.
- `/terms` is the submission grant + the corpus's CC0 offer. Both publish routes echo it
  on `201` (`terms` field + `Link: …; rel="terms-of-service"`) via `acceptedSubmission`
  in `lib/http.ts` — API publishers never see the notice on `/submit`. Unreviewed draft;
  the `TODO(legal)` in the page lists what a lawyer still has to add.
- Landing typography/colour: `--font-display` (Instrument Serif) and the `--brand` amber
  are defined in `globals.css` and used only by the landing page.

## Design language

- Flat + hairline: surfaces are `rounded-2xl border bg-card` with no shadow; overlays
  (dropdown, popover, sheet) all use `shadow-md ring-1 ring-foreground/10`.
- Header utility controls follow the shadcn site-header idiom: ghost icon buttons
  (`variant="ghost"`, `size="icon"`) + bare circular avatar — button chrome is
  reserved for CTAs. The whole header row shares one `gap-2` rhythm, and every item
  carries equivalent optical padding so the gaps read even: links get `px-2 py-1`,
  the vendored UserButton trigger gets `p-1` with a `size-6` avatar (32px box =
  Button `size="icon"`).
  Nav links (desktop + mobile sheet) mark the current page
  with `text-brand` + `aria-current` — brand amber always means "active".
- Header lives in `app/layout.tsx` (server component); interactive parts are client
  islands: `desktop-nav.tsx`, `mobile-nav.tsx` (sheet), `theme-toggle.tsx`. Link list +
  active-route check are shared in `lib/nav-links.ts`.

## Registry model (the served truth)

- **`package_versions` rows are the served truth directly** — no snapshot table.
  `GET /api/packages/lookup` and browse (`GET /api/packages`) both serve each
  package's _latest_ version (`max(version)`); there is no unverified/verified
  split and no `yolo` param. Seeded packages are immediately servable (0 installs, but
  visible) — see `docs/erd.md`.
- **Versions are append-only.** `POST /api/packages/:id/versions` (owner-only) inserts
  the next version; nothing is ever mutated or deleted. `PATCH /api/packages/:id` only
  touches `packages` metadata (title/description/domain) and never
  touches urlPatterns/tools/minEngine (the latter is version-scoped, on
  `package_versions`).
- **Installs are auth-only and pin-by-default.** `PUT /api/packages/:id/install` sets
  the caller's pin — idempotent: creates it if absent, moves it if present (also how
  rollback works — pass an older `versionId`; defaults to latest). `DELETE` removes it.
  `GET /api/installs` (authenticated) returns the caller's pinned packages at their
  pinned versions. This account pin is separate from the extension's local, in-browser
  install (the MCP server's install path vs. the install button's). **Install counts are
  not a trust signal** — `webMcpPackageSchema.installCount` is deprecated and no longer
  populated; trust is derived from readable data and explicit consent instead
  (`docs/local-first-installs.md`).

## Env & dev

- `.env` (gitignored) needs real `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET`,
  `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`; `.env.example` has placeholders.
  t3-env (`env.ts`) validates at build time — `next build` fails without them.
- Dev server owns port 3000 — the extension's default registry URL points here.
  One instance only; check `lsof -nP -i :3000` for strays.
- `scripts/seed.ts` seeds the curated packages from `@webmcp-cafe/definitions`
  (6 packages / 18 tools, incl. the tier-1 Reddit package).

## Auth

- better-auth 1.6.x with email/password + GitHub OAuth; apiKey plugin lives in the separate
  package `@better-auth/api-key` (server: root export; client: `/client`).
  Its 1.6.25 table schema keys the owner as `reference_id` (+ `config_id`),
  not `user_id` — keep `packages/db/src/apikey-schema.ts` matched to the
  plugin's expected fields or every api-key endpoint 500s.
- **Auth tables live in the `auth` Postgres schema**, not `public` (`pgSchema("auth")`
  in `packages/db/src/auth-schema.ts`; `apikey-schema.ts` hangs off the same
  `authDbSchema`). Hand-run SQL needs the qualifier — `select * from auth.users`.
  App tables stay in `public` and reference `auth.users` across schemas.
  `drizzle.config.ts` sets `schemaFilter: ["public", "auth"]`; without it
  introspect/push default to `public` only and would propose dropping the auth set.
- **Auth table naming:** SQL names are plural snake_case like the app-owned tables
  (`users`, `sessions`, `accounts`, `verifications`, `api_keys`), but the drizzle
  **export names stay singular** (`user`, …, `apikey`). better-auth resolves models
  as a `schema[model]` property read against `packages/db/src/index.ts`'s `schema`
  object and never sees the SQL name (or the namespace) — rename an export and you get
  `[# Drizzle Adapter]: The model "user" was not found in the schema object`.
  Don't "fix" the mismatch, and don't set `usePlural` (it naively appends `s`,
  which would want `apikeys`).
- Agent writes use `Authorization: Bearer <api key>` (created at
  `/settings/security`); browser flows use session cookies. `lib/api-auth.ts` maps the
  Bearer header to `x-api-key` (better-auth only reads the latter), and the plugin
  **must** be constructed as `apiKey({ enableSessionForAPIKeys: true })` — it defaults
  to `false`, in which case `getSession` returns `null` rather than erroring and every
  agent write path 401s.
- Per-key rate limit defaults to **10 requests / 24h** (plugin defaults, visible on the
  created key row as `rate_limit_max` / `rate_limit_time_window`). Raise it via the
  plugin's rate-limit options before agents do anything at volume.
- Auth UI is **better-auth-ui** (vendored shadcn registry components in
  `components/auth/`, wired by `components/providers.tsx`):
  - `/auth/[path]` — sign-in/sign-up (email/password + GitHub) and sign-out.
    No email sender is configured, so `forgotPassword: false` in
    `providers.tsx` hides the reset flow and email verification is off.
  - `/settings/[path]` — account + security tabs (API keys live under
    security). Server-gated with `ensureSession` + `HydrationBoundary`;
    `/settings` redirects to `/settings/account`.
  - Navbar identity is `<UserButton size="icon" />`.
- `useAuth().authClient` is typed as the _base_ client. Vendored components
  that need plugin-typed hooks import the app's typed `@/lib/auth-client`
  directly instead of casting (repo no-`as` rule). `auth-client.ts` registers
  `usernameClient()` + `multiSessionClient()` only to satisfy those hook
  types — the server runs neither plugin.
- Toasts: shadcn `sonner`, but `components/ui/sonner.tsx` observes the `.dark`
  class on `<html>` (repo theme mechanism) — next-themes is not installed.
