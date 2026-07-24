# AGENTS.md — WebMCP Cafe

Community registry of third-party WebMCP tool configs injected into sites that haven't
implemented WebMCP — "Greasyfork for the agentic web".

## Status: PRE-PRODUCTION (delete this section on launch)

- Not deployed; no real users or data. Skip production concerns (zero-downtime
  migrations, backfills, API backwards compat).
- DB wipes/resets are always acceptable — prefer clean migrations; seeds repopulate.

## Layout

```
apps/web/          Next.js — registry UI + public REST API
apps/extension/    WXT — config lookup + tool injection
packages/schema/   @robertn702/webmcp-cafe-schema — zod config format (published); keystone, all consumers validate against it
packages/db/       Drizzle + Neon — schema + client
packages/mcp/      @robertn702/webmcp-cafe-mcp — MCP server (published)
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

## Stack (decided — do not relitigate)

Bun + Turborepo, TypeScript strict ESM, Next.js + React 19 + Tailwind 4 + shadcn/ui,
Next route handlers + zod (no tRPC), Neon Postgres + Drizzle, better-auth (GitHub OAuth
\+ API-key plugin), zod v4, @t3-oss/env, Vitest, ESLint + Prettier, Changesets,
@modelcontextprotocol/sdk.

## Conventions

- No `as` assertions except `as const` (ESLint-enforced) — validate with zod at
  boundaries, narrow with runtime checks.
- Simplicity bias: smallest version that works; no abstraction without a current need.
- Conventional commits; keep `main` green (typecheck + lint + test before committing).
- Skills install project-locally via `npx skills add` (never `-g`).
- Published packages must list `LICENSE` in their `files` array.
- `CLAUDE.md` symlinks to `AGENTS.md` (pre-commit auto-creates) — never diverge them.
- Env: `apps/web/.env.example` lists required vars (`DATABASE_URL`, GitHub OAuth,
  `BETTER_AUTH_SECRET`).

## WebMCP essentials (July 2026)

- Feature-detect: `const mc = document.modelContext ?? navigator.modelContext`.
- `await mc.registerTool({ name, description, inputSchema, execute, annotations }, { signal })`
  — rejects on duplicate names.
- Chrome origin trial 149→156; local dev needs `chrome://flags/#enable-webmcp-testing`.
- Char budgets: 500/tool description, 150/param description, 30/name, 1.5K/tool output.
- Open question: content-script registration may break when WebMCP ships stable
  (origin-isolation gating) — track https://github.com/webmachinelearning/webmcp.

## Config format

- `{ domain, urlPatterns[], title, description, tools[], changelog? }`; `urlPatterns` is
  Chrome `@match`-style (`scheme://host/path`), versioned alongside `tools`.
- Tool `execution`: simple mode (fields/autosubmit/resultSelector) or multi-step
  (`navigate | click | fill | select | wait | extract | scroll | condition`).
- No `evaluate` step (arbitrary code execution in the user's logged-in page).
- `minEngine`: positive-integer capability level (not semver), version-scoped.
- Extension must skip + warn on tool-name collision with site-registered tools.

## Registry data model

- Trust = install count, not verification. `webmcp_definitions` (mutable) /
  `definition_versions` (append-only; the served truth) / `installs` (pins
  user→version). ERD: `docs/erd.md`; served-truth rules: `apps/web/AGENTS.md`.
- No `(domain, url_pattern)` uniqueness — rival packages may target the same site;
  installs + pattern specificity rank them.

## Gotchas

- drizzle-kit `generate` prompts interactively on renames (needs a TTY) — use
  `generate --custom`, hand-fill SQL + meta snapshot, verify with plain `generate`.
- `packages/schema` resolves via `dist/` — rebuild it after schema changes or consumers
  see bizarre validation errors.
- Ports: web 3000 / wxt 5173 / CDP 9222 — find strays with
  `lsof -nP -i :3000 -i :5173 -i :9222`; killing a bun wrapper does NOT kill its node
  child.

## References

| Need                           | File                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| System architecture + diagrams | `ARCHITECTURE.md`                                                                                                               |
| Web app + API notes            | `apps/web/AGENTS.md`                                                                                                            |
| Extension notes                | `apps/extension/AGENTS.md`                                                                                                      |
| Data model ERD                 | `docs/erd.md`                                                                                                                   |
| API execution model            | `docs/api-execution-model.md`                                                                                                   |
| Decision history (archive)     | `docs/DECISIONS.md`                                                                                                             |
| Reference impl (MIT, ported)   | [web-mcp-hub](https://github.com/Joakim-Sael/web-mcp-hub) + [webmcp-extension](https://github.com/Joakim-Sael/webmcp-extension) |
