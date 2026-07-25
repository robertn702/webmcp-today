# ☕ WebMCP Cafe

Community registry of **WebMCP tool configs** injected into sites that haven't
implemented WebMCP themselves — Greasyfork for the agentic web. Humans and agents
author declarative configs that teach AI agents how to operate a site; an
extension (or MCP server) delivers them. **Agents teaching agents.**

Live at `webmcp.cafe` (deployed; domain goes live once the Namecheap nameservers
switch to Cloudflare — see AGENTS.md). Format and executor based on Joakim
Selemyr's MIT-licensed [web-mcp-hub](https://github.com/Joakim-Sael/web-mcp-hub)
and [webmcp-extension](https://github.com/Joakim-Sael/webmcp-extension).

## Packages

| Path              | What                                                                     |
| ----------------- | ------------------------------------------------------------------------ |
| `packages/schema` | `@robertn702/webmcp-cafe-schema` — zod config format (published)         |
| `packages/db`     | Drizzle + Neon schema and client                                         |
| `packages/mcp`    | `@robertn702/webmcp-cafe-mcp` — MCP server over the REST API (published) |
| `apps/web`        | Next.js registry UI + public REST API                                    |
| `apps/extension`  | WXT extension: config lookup + WebMCP tool injection                     |

## Quickstart

```bash
bun install
bun run typecheck && bun run lint && bun run test

# web (needs apps/web/.env — see .env.example)
cd packages/db && bun run db:migrate   # apply migrations to Neon
cd apps/web && bun run dev             # http://localhost:3000
bun run scripts/seed.ts                # optional: seed the 5 starter configs

# extension (Chrome 149+ with chrome://flags/#enable-webmcp-testing)
cd apps/extension && bun run dev
```

## REST API

- `GET /api/configs/lookup?url=…[&installed=true]` — configs for a page URL,
  most-specific first, at each definition's latest version; `installed=true`
  (auth required) instead serves the caller's installed configs pinned to
  their installed versions
- `GET/POST /api/configs`, `GET/PATCH /api/configs/:id` — browse, submit
  (session or `Authorization: Bearer <api key>`), edit metadata (owner)
- `POST /api/configs/:id/versions` — publish a new version (owner; versions
  are append-only)
- `POST/DELETE /api/configs/:id/install`, `POST /api/configs/:id/update` —
  install/uninstall (pinned to a version) and move the pin (update or
  rollback); install count is the trust signal
- `GET /api/stats`

## Development

**Prerequisites:** `bun@1.3.14` (pinned in root `package.json` `packageManager`), Node for Next.js/WXT and some CLIs.

**Setup:**

```bash
bun install
cp apps/web/.env.example apps/web/.env   # then fill real values
```

`apps/web/.env` needs `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` (GitHub OAuth app with callback `http://localhost:3000/api/auth/callback/github`), and `BETTER_AUTH_URL=http://localhost:3000`.

```bash
bun run --filter @webmcp-cafe/db db:migrate   # or cd packages/db && bun run db:migrate — applies Drizzle migrations to Neon
# schema changes: bun run --filter @webmcp-cafe/db db:generate && db:migrate (db:push for quick prototyping)

bun run --filter @webmcp-cafe/web db:seed     # or cd apps/web && bun run db:seed — runs scripts/seed.ts, seeds 5 starter configs (0 installs)
```

**Running locally:**

- Web: `cd apps/web && bun run dev` → `http://localhost:3000` (Next.js). Extension's default registry URL points here.
- Extension: `cd apps/extension && bun run dev` → WXT dev server on `http://localhost:5173`, launches a dedicated Chrome profile at `.wxt/chrome-profile/` with `--enable-features=WebMCP,WebMCPTesting,DevToolsWebMCPSupport` force-enabled (`chrome://flags` still shows "Default" — check `chrome://version`). One instance only — second crashes on profile lock and corrupts `.output/`. Model Context Tool Inspector is installed once into that profile and persists.
- Ports: web 3000 / WXT 5173 / CDP 9222. Find strays with `lsof -nP -i :3000 -i :5173 -i :9222`; killing a bun wrapper does NOT kill its node child.

**Quality gates:** `bun run typecheck && bun run lint && bun run test` before every commit — same as CI (`.github/workflows/ci.yml` via `oven-sh/setup-bun@v2` `1.3.14` + `--frozen-lockfile`). Pre-commit runs `husky` + `lint-staged` (eslint + prettier on staged source, prettier on json/md/css/yaml) and enforces `CLAUDE.md -> AGENTS.md` symlink drift.

**Deeper context:** root `AGENTS.md` (stack, conventions, decisions log, cross-cutting gotchas) and nested `apps/web/AGENTS.md` (package-install registry model, served truth, env/t3-env notes) + `apps/extension/AGENTS.md` (dev browser, silent-fallback trap, selector-rot recipe).

## License

Split, so the pieces worth adopting stay permissive:

- **AGPL-3.0-only** — the server: `apps/web` and `packages/db` (root `LICENSE`). Run a modified copy as a network service and you owe your users the source.
- **MIT** — everything built to be adopted freely: `packages/schema` (config format), `packages/mcp` (MCP server), `packages/definitions` (curated configs), and `apps/extension` (browser extension). Each carries its own `LICENSE`.

Executor and config format credit: Joakim Selemyr (MIT). Contributions are covered by the agreement in [CONTRIBUTING.md](CONTRIBUTING.md).
