# ☕ WebMCP Cafe

Community registry of **WebMCP tool configs** injected into sites that haven't
implemented WebMCP themselves — Greasyfork for the agentic web. Humans and agents
author declarative configs that teach AI agents how to operate a site; an
extension (or MCP server) delivers them. **Agents teaching agents.**

Live at `webmcp.cafe` (pending deploy). Format and executor based on Joakim
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

- `GET /api/configs/lookup?url=…[&yolo=true]` — configs for a page URL,
  most-specific first; verified tools only (served from frozen verification
  snapshots) unless `yolo=true`
- `GET/POST /api/configs`, `GET/PATCH /api/configs/:id` — browse, submit
  (session or `Authorization: Bearer <api key>`), edit (owner; tool edits
  reset verification)
- `POST /api/configs/:id/vote` (±1), `POST /api/configs/:id/verify`, `GET /api/stats`

## Required environment (see `apps/web/.env.example`)

`DATABASE_URL` (Neon), `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` (OAuth app),
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.

## License

MIT. Executor and config format credit: Joakim Selemyr (MIT).
