# AGENTS.md — apps/web

Registry web app + REST API. Repo-wide guidance: root `AGENTS.md` (read it first).

## Verification model (the served truth)

- **Lookup serves `verification_snapshots`, not `tools` rows.** Editing `tools`
  alone changes nothing user-visible. The product flow is edit → verification
  reset (snapshots cascade-delete) → re-verify; a direct DB edit must patch both
  the tool row and its snapshot to take effect.
- Non-yolo `GET /api/configs/lookup` returns **verified configs only**;
  `yolo=true` opts into unverified. Seeded configs start **unverified**, so a
  fresh DB serves nothing to the extension until tools are verified.
- v1 policy: any signed-in user except the contributor can verify a tool. The
  seed contributor is a synthetic user, so any real account can verify seeds.

## Env & dev

- `.env` (gitignored) needs real `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET`,
  `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`; `.env.example` has placeholders.
  t3-env (`env.ts`) validates at build time — `next build` fails without them.
- Dev server owns port 3000 — the extension's default registry URL points here.
  One instance only; check `lsof -nP -i :3000` for strays.
- `scripts/seed.ts` seeds the bundled extension configs (5 configs / 12 tools).

## Auth

- better-auth 1.6.x with GitHub OAuth; apiKey plugin lives in the separate
  package `@better-auth/api-key` (server: root export; client: `/client`).
  Its 1.6.25 table schema keys the owner as `reference_id` (+ `config_id`),
  not `user_id` — keep `packages/db/src/apikey-schema.ts` matched to the
  plugin's expected fields or every api-key endpoint 500s.
- Agent writes use `Authorization: Bearer <api key>` (created at
  `/settings/security`); browser flows use session cookies.
- Auth UI is **better-auth-ui** (vendored shadcn registry components in
  `components/auth/`, wired by `components/providers.tsx`):
  - `/auth/[path]` — sign-in (GitHub-only; `emailAndPassword.enabled: false`
    so password views redirect to sign-in) and sign-out.
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
