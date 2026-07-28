# AGENTS.md — WebMCP Cafe

Community registry of third-party WebMCP tool packages injected into sites that haven't
implemented WebMCP — "Greasyfork for the agentic web".

## Status: PRE-PRODUCTION (delete this section on launch)

- Deployed to prod (Vercel + `webmcp.cafe`) but pre-launch — no real users or
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
packages/schema/        @robertn702/webmcp-cafe-schema — zod package format (not yet published to npm); keystone, all consumers validate against it
packages/db/            Drizzle + Neon — schema + client
packages/definitions/   @webmcp-cafe/definitions — curated first-party packages (extension fallback bundle + registry seed source)
packages/mcp/           @robertn702/webmcp-cafe-mcp — MCP server (not yet published to npm)
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

- Hosting: Vercel project `webmcp-cafe`, team `robert-1554` (orgId
  `team_rckbXC20kaxUXeA1qKq8UxVZ`); linked via `.vercel/project.json`. The GitHub
  integration auto-deploys — Production on every push to `main`, a Preview per PR;
  `vercel --prod` from the repo root is the manual override, not the normal path.
  Consequence: merging a schema-breaking change deploys the new code before any
  migration runs — migrate Neon first, or accept a window of 500s.
- Required env vars must exist in the Vercel project (Production) or the build
  fails at "Collecting page data" (t3-env validates on import). Set with
  `vercel env add <NAME> production`; local source of truth is `apps/web/.env`
  (override `BETTER_AUTH_URL` to the prod origin for Production).
- Domain `webmcp.cafe`: registered at **Namecheap**, DNS on **Cloudflare** (zone
  `fc81b4d78657c27568e2d4376de57bbd`, **DNS-only**/grey cloud). Records:
  `A @ → 76.76.21.21`, `CNAME www → cname.vercel-dns.com`; www 308→apex. Going live
  needs the Namecheap nameservers switched to the two Cloudflare NS
  (`diva`/`patrick.ns.cloudflare.com`). CF API token: 1Password robertn702 →
  Private, "Cloudflare API Token (webmcp-cafe)".
- Vercel token/scope quirks (which token to use, the `robertniimi` 403 trap):
  global `~/.config/opencode/AGENTS.md` "Vercel". Vercel refuses
  `vercel domains add` while the latest prod deploy is errored — fix the deploy
  first, then attach the domain.
- GitHub OAuth prod sign-in needs `https://webmcp.cafe/api/auth/callback/github`
  added to the OAuth app's authorized callbacks.

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
  `BETTER_AUTH_SECRET`).

## WebMCP essentials (July 2026)

- Feature-detect: `const mc = document.modelContext ?? navigator.modelContext`.
- `await mc.registerTool({ name, description, inputSchema, execute, annotations }, { signal })`
  — rejects on duplicate names.
- Chrome origin trial 149→156; local dev **and end users** need
  `chrome://flags/#enable-webmcp-testing` — sites we inject into never serve an
  origin-trial token on our behalf (docs/DECISIONS.md 2026-07-24).
- Char budgets (Chrome guidance): we enforce 500/tool description, 150/param
  description, 30/name at publish time; tool output is uncapped in v1 (Chrome's 1.5K is
  guidance, not enforcement — see docs/DECISIONS.md 2026-07-24).
- Platform risks (unsanctioned extension registration, `tools=()` kill switch):
  docs/platform-risks.md; track webmachinelearning/webmcp#74.

## Package format

- `{ domain, urlPatterns[], title, description, tools[], changelog? }`; `urlPatterns` is
  Chrome `@match`-style (`scheme://host/path`), versioned alongside `tools`.
- Tool `execution`: simple mode (fields/autosubmit/resultSelector) or multi-step
  (`navigate | click | fill | select | wait | extract | scroll | condition`).
- No `evaluate` step (arbitrary code execution in the user's logged-in page).
- `minEngine`: positive-integer capability level (not semver), version-scoped.
- Extension must skip + warn on tool-name collision with site-registered tools.
- `ENGINE_VERSION` is **pegged at 1 until release** — change the format shape freely,
  don't bump it (`packages/schema/src/budgets.ts` says why).
- Tier-1 `api` block: `returns` is a JMESPath expression; `extract`/`errorPath` are
  locator arrays (`["json","errors"]`); `sendAs` is `{in, name}`; an endpoint declares
  at most one of `graphql`/`form`/`body`. A `body` or `graphql.variables` leaf that is
  exactly one `{{param}}` keeps its type.
- **Never add `jsonpath-plus`, `jsonpath`, or anything depending on `static-eval`** —
  they call `new Function`, which MV3's CSP rejects in the content script, and both
  carry RCE CVEs. Response projection is `@jmespath-community/jmespath` (no `eval`).
  Reasoning: `docs/DECISIONS.md` 2026-07-27.

## Registry data model

- Trust = install count, not verification. `packages` (mutable) /
  `package_versions` (append-only; the served truth) / `installs` (pins
  user→version). ERD: `docs/erd.md`; served-truth rules: `apps/web/AGENTS.md`.
- No `(domain, url_pattern)` uniqueness — rival packages may target the same site;
  installs + pattern specificity rank them.
- Two Postgres namespaces: app tables in `public`, better-auth's in `auth`
  (`auth.users`, …) — hand-run SQL must qualify. See `apps/web/AGENTS.md` § Auth.

## Gotchas

- drizzle-kit `generate` prompts interactively on renames (needs a TTY) — use
  `generate --custom`, hand-fill SQL + meta snapshot, verify with plain `generate`.
- `packages/schema` resolves via `dist/` — rebuild it after schema changes or consumers
  see bizarre validation errors.
- Ports: web 3000 / wxt 5173 / CDP 9222 — find strays with
  `lsof -nP -i :3000 -i :5173 -i :9222`; killing a bun wrapper does NOT kill its node
  child.

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
| Data model ERD                  | `docs/erd.md`                                                                                                                   |
| API execution model             | `docs/api-execution-model.md`                                                                                                   |
| Platform risk register          | `docs/platform-risks.md`                                                                                                        |
| Why non-obvious calls were made | `docs/DECISIONS.md`                                                                                                             |
| Open follow-ups (prune as done) | `docs/BACKLOG.md`                                                                                                               |
| Reference impl (MIT, ported)    | [web-mcp-hub](https://github.com/Joakim-Sael/web-mcp-hub) + [webmcp-extension](https://github.com/Joakim-Sael/webmcp-extension) |
