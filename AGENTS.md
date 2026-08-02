# AGENTS.md — WebMCP Today

Community registry of third-party WebMCP packages injected into sites that haven't
implemented WebMCP — "Greasyfork for the agentic web".

## Status: PRE-PRODUCTION (delete this section on launch)

- Deployed to prod (Vercel + `webmcp.today`) but pre-launch — no real users or
  data. Skip production concerns (zero-downtime migrations, backfills, API
  backwards compat).
- DB wipes/resets are still acceptable — prefer clean migrations; seeds repopulate.
- **Nothing is published to npm yet** — `packages/schema` and `packages/mcp` are
  consumed locally only; changesets are not in use pre-launch.
- Schema changes are squashed into `packages/db/migrations/0000_init.sql`: edit it and
  its meta snapshot in place rather than stacking a migration, then confirm drift-free
  with `drizzle-kit generate` ("No schema changes, nothing to migrate").

## Layout

```
apps/web/          Next.js — registry UI + public REST API
apps/extension/    WXT — package lookup + tool injection
packages/schema/            @robertn702/webmcp-today-schema — zod package format (not yet published to npm); keystone, all consumers validate against it
packages/engine/            @robertn702/webmcp-today-engine — API execution engine (not yet published to npm); MIT, consumed by the extension
packages/db/                Drizzle + Neon — schema + client
packages/curated-packages/  @webmcp-today/curated-packages — curated first-party packages (registry seed source)
packages/mcp/               @robertn702/webmcp-today-mcp — MCP server (not yet published to npm)
```

## Commands

| Task      | Command             |
| --------- | ------------------- |
| Typecheck | `bun run typecheck` |
| Lint      | `bun run lint`      |
| Test      | `bun run test`      |
| Build     | `bun run build`     |

- Lint runs once at the root; typecheck/test/build fan out via turbo. `apps/web` build
  needs real env vars (t3-env validates at build).

## Deploy, domain & DNS

- Hosting: Vercel project `webmcp-today`, team `robertniimi` (orgId
  `team_rckbXC20kaxUXeA1qKq8UxVZ`); linked via `.vercel/project.json`. The GitHub
  integration auto-deploys — Production on every push to `main`, a Preview per PR;
  `vercel --prod` from the repo root is the manual override, not the normal path.
  Consequence: merging a schema-breaking change deploys the new code before any
  migration runs — migrate Neon first, or accept a window of 500s.
- Required env vars must exist in the Vercel project (Production) or the build
  fails at "Collecting page data" (t3-env validates on import). Set with
  `vercel env add <NAME> production`; local source of truth is `apps/web/.env`
  (override `BETTER_AUTH_URL` to the prod origin for Production).
- Domain `webmcp.today`: registered at **Namecheap**, DNS on **Cloudflare** (zone
  `fc81b4d78657c27568e2d4376de57bbd`, **DNS-only**/grey cloud; nameservers pointed
  at `diva`/`patrick.ns.cloudflare.com`). Records: `A @ → 76.76.21.21`,
  `CNAME www → cname.vercel-dns.com`; www 308→apex. CF API token: 1Password
  robertn702 → Private, "Cloudflare API Token (webmcp-today)" (the item may still
  be labeled "webmcp-cafe" — label only).
- Renamed from `webmcp.cafe` on 2026-07-28 (docs/DECISIONS.md) — keep the old
  domain registered and attached in Vercel as a redirect to `webmcp.today`.
- Vercel token/scope quirks (which token to use, the `robertniimi` 403 trap):
  global `~/.config/opencode/AGENTS.md` "Vercel". Vercel refuses
  `vercel domains add` while the latest prod deploy is errored — fix the deploy
  first, then attach the domain.
- GitHub OAuth uses **two apps** (an OAuth App allows exactly one callback URL):
  `WebMCP Today (dev)` → `http://localhost:3000/api/auth/callback/github`, and
  `WebMCP Today` (prod, github.com/settings/applications/3759220) →
  `https://webmcp.today/api/auth/callback/github`. Prod creds are Vercel env vars;
  dev creds live in `apps/web/.env`.
- Set Vercel env vars via the **API** (`POST /v10/projects/<name>/env?upsert=true`),
  not `vercel env add` — CLI 54.x silently stores **empty** values when the value
  is piped via stdin (this is why prod vars were empty placeholders originally).
- Neon Preview branches are removed when a PR closes by
  `.github/workflows/cleanup-neon-preview.yml`. Keep the repository variable
  `NEON_PROJECT_ID` and secret `NEON_API_KEY` configured; closed PR Preview URLs
  intentionally lose database access. Manually remove existing stale `preview/*`
  branches in Neon before relying on the workflow to keep the Free-plan limit clear.

## Stack (decided — do not relitigate)

Bun + Turborepo, TypeScript strict ESM, Next.js + React 19 + Tailwind 4 + shadcn/ui,
Next route handlers + zod (no tRPC), Neon Postgres + Drizzle, better-auth (GitHub OAuth
\+ API-key plugin), zod v4, @t3-oss/env, Vitest, ESLint + Prettier, Changesets
(not in use pre-launch), @modelcontextprotocol/sdk.

## Conventions

- No `as` assertions except `as const` (ESLint-enforced) — validate with zod at
  boundaries, narrow with runtime checks.
- Simplicity bias: smallest version that works; no abstraction without a current need.
- Conventional commits; keep `main` green (typecheck + lint + test before committing).
- Skills install project-locally via `npx skills add` (never `-g`).
- Once a package is published to npm, its `files` array must list `LICENSE`.
- `CLAUDE.md` symlinks to `AGENTS.md` (pre-commit auto-creates) — never diverge them.
- Env: `apps/web/.env.example` lists required vars (`DATABASE_URL`, GitHub OAuth,
  `BETTER_AUTH_SECRET`, `OAUTH_PROXY_SECRET`, `OAUTH_PROXY_PRODUCTION_URL`).

## WebMCP essentials (July 2026)

- Feature-detect: `const mc = document.modelContext ?? navigator.modelContext`.
- `await mc.registerTool({ name, description, inputSchema, execute, annotations }, { signal })`
  — rejects on duplicate names.
- Chrome origin trial 149→156; local dev **and end users** need
  `chrome://flags/#enable-webmcp-testing` — sites we inject into never serve an
  origin-trial token on our behalf (docs/DECISIONS.md 2026-07-24).
- Char budgets (Chrome guidance): we enforce 500/tool description, 1000/param
  description, 30/name at publish time; tool output is uncapped in v1 (Chrome's 1.5K is
  guidance, not enforcement — see docs/DECISIONS.md 2026-07-24).
- Platform risks (unsanctioned extension registration, `tools=()` kill switch):
  docs/platform-risks.md; track webmachinelearning/webmcp#74.

## Package format

- `{ version, domain, urlPatterns[], title, description, tools[], changelog? }`; `urlPatterns` is
  Chrome `@match`-style (`scheme://host/path`), versioned alongside `tools`.
- `version`: author-declared positive integer (not semver) — `1` on create, exactly
  `max(version)+1` on publish, or the API 409s with `expectedVersion`
  (docs/DECISIONS.md 2026-07-29).
- Tool `execution` is `api`-mode only: the tool binds to an entry in the
  package-level `api.endpoints` block by name. (DOM execution was cut
  pre-launch — `docs/DECISIONS.md` 2026-07-28.)
- `minEngine`: positive-integer capability level (not semver), version-scoped.
- Extension must skip + warn on tool-name collision with site-registered tools.
- `ENGINE_VERSION` is **pegged at 1 until release** — change the format shape freely,
  don't bump it (`packages/schema/src/budgets.ts` says why).
- Tier-1 `api` block: `returns` is a JMESPath expression; `errorPath` and auth-source
  `extract` are locator arrays (`["json","errors"]`); an auth source declares exactly
  one of `extract` (JSON locator) or `pattern` (regex over the raw response text,
  capture group 1 = token — for HTML token sources like HN); `sendAs` is `{in, name}`
  with `in` one of `header`/`form`/`query`; `stripPrefix` is a literal response
  prefix removed before JSON parsing (Google's anti-XSSI `)]}'` — Maps/Gmail); an
  endpoint declares at most one of `graphql`/`form`/`body`. A `body` or
  `graphql.variables` leaf that is exactly one `{{param}}` keeps its type.
- **Never add `jsonpath-plus`, `jsonpath`, or anything depending on `static-eval`** —
  they call `new Function`, which MV3's CSP rejects in the content script, and both
  carry RCE CVEs. Response projection is `@jmespath-community/jmespath` (no `eval`).
  Reasoning: `docs/DECISIONS.md` 2026-07-27.

## Registry data model

- `packages` (mutable) / `package_versions` (append-only; the served truth) /
  `installs` (auth-only per-user version pins). Browse serves max(version);
  users stay on their pinned version. ERD: `docs/erd.md`; served-truth rules:
  `apps/web/AGENTS.md`.
- No `(domain, url_pattern)` uniqueness — rival packages may target the same site;
  installs + pattern specificity rank them.
- Two Postgres namespaces: app tables in `public`, better-auth's in `auth`
  (`auth.users`, …) — hand-run SQL must qualify. See `apps/web/AGENTS.md` § Auth.

## Gotchas

- drizzle-kit `generate` prompts interactively on renames (needs a TTY) — use
  `generate --custom`, hand-fill SQL + meta snapshot, verify with plain `generate`.
- `packages/schema` resolves via `dist/` — rebuild it after schema changes or consumers
  see bizarre validation errors.
- Ports: web 3000 / WXT 5173 — find strays with `lsof -nP -i :3000 -i :5173`;
  killing a bun wrapper does NOT kill its node child.

## Decision log (`docs/DECISIONS.md`)

Append an entry only when all three hold; otherwise the artifact _is_ the record, so
don't restate it.

1. A real alternative was rejected — not "built the obvious thing".
2. The reasoning is **not** recoverable from the code, schema, config or another doc.
3. A future agent could plausibly undo or relitigate it.

Never log implementation narratives, "verified X works" sessions, scaffolding/lint/docs
housekeeping, or anything an `AGENTS.md` / `ARCHITECTURE.md` / `docs/*` already says.
Anything an agent must obey _right now_ belongs in the nearest `AGENTS.md`; the log
holds only the why.

Format: one dated bullet, ≤10 lines, bold lede stating the decision, then the why, then
the non-obvious consequence — the rejected alternative is the valuable half. When a
decision supersedes an older entry, **rewrite or delete that entry** instead of stacking
a correction, and prune entries whose reasoning has since migrated into code or docs.

## References

| Need                            | File                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| System architecture + diagrams  | `ARCHITECTURE.md`                                                                                                               |
| Web app + API notes             | `apps/web/AGENTS.md`                                                                                                            |
| Extension notes                 | `apps/extension/AGENTS.md`                                                                                                      |
| Extension internal map          | `apps/extension/ARCHITECTURE.md`                                                                                                |
| Data model ERD                  | `docs/erd.md`                                                                                                                   |
| Execution model (API-only)      | `docs/api-execution-model.md`                                                                                                   |
| Platform risk register          | `docs/platform-risks.md`                                                                                                        |
| Why non-obvious calls were made | `docs/DECISIONS.md`                                                                                                             |
| Open follow-ups (prune as done) | `docs/BACKLOG.md`                                                                                                               |
| Reference impl (MIT, ported)    | [web-mcp-hub](https://github.com/Joakim-Sael/web-mcp-hub) + [webmcp-extension](https://github.com/Joakim-Sael/webmcp-extension) |
