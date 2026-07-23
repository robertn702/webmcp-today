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

- Based on Joakim's format: `{ domain, urlPattern, title, description, tools[] }`; tool
  `execution` is simple mode (fields/autosubmit/resultSelector) or multi-step
  (`navigate | click | fill | select | wait | extract | scroll | condition`).
- **No `evaluate` step in v1** (arbitrary code execution in the user's logged-in page).
- Schema leaves room for health/canary metadata and multi-reviewer verification
  snapshots; `minEngine` field so the format can evolve.
- Registry API serves verified configs only by default; `yolo=true` opts into unverified.
- Extension must skip + warn on tool-name collision with site-registered tools.

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
