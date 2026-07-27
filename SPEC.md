# WebMCP Cafe — Build Spec (Handoff Document)

> This file is the complete handoff brief for the agent scaffolding and building this
> project. It was written after a full investigation session. Everything you need is
> here — do not assume any other context.

> **⚠ Historical (2026-07-24):** this is the original plan, kept for context — it is
> no longer normative. The per-tool verification model (verification snapshots,
> `yolo`, votes, `verify` endpoint, MCP `vote_on_config`) was replaced by the
> package-install model (`packages` / append-only `package_versions` /
> `installs`; see `docs/erd.md` and the root `AGENTS.md` decisions log), `urlPattern`
> became `urlPatterns` (Chrome `@match`-style array), and the leaderboard page was
> cut. Where this file and current code disagree, the code + `AGENTS.md` win.

## What this project is

**WebMCP Cafe** is a community registry of third-party **WebMCP tool configs** that are
injected into websites that haven't implemented WebMCP themselves. Think "Greasyfork for
the agentic web": community members (humans and agents) author declarative configs that
teach AI agents how to operate a site — fill its forms, navigate its flows, extract its
data — and any agent visiting that site gets those tools instantly.

Pitch: **agents teaching agents.** Domain: `webmcp.cafe` (purchased).

### Background: WebMCP state (July 2026)

- WebMCP is a W3C Community Group draft co-authored by Google + Microsoft. Websites
  register callable tools (name, description, JSON Schema input, execute callback) that
  in-browser AI agents invoke instead of scraping the DOM.
- **Spec:** https://webmachinelearning.github.io/webmcp/ (21 July 2026 draft)
- **API moved** from `navigator.modelContext` to `document.modelContext` in the 21 July
  draft; Chrome 150 deprecates the `navigator` location. Always feature-detect:
  `const mc = document.modelContext ?? navigator.modelContext`
- Key API: `await mc.registerTool({ name, description, inputSchema, execute, annotations }, { signal })`
  (Promise-based; rejects on duplicate names). Annotation hints: `readOnlyHint`,
  `untrustedContentHint`. `getTools()` exists for in-page agents; browser agents use an
  internal mechanism — **tools carry no provenance**, so extension-injected tools are
  indistinguishable from site-registered ones today.
- Chrome origin trial runs Chrome 149→156; local dev requires
  `chrome://flags/#enable-webmcp-testing`. Edge 147 has it behind a flag.
- Chrome docs: https://developer.chrome.com/docs/ai/webmcp and .../webmcp/secure-tools
- Character budgets (Chrome guidance): 500 chars/tool description, 150/param description,
  30/name, 1.5K/tool output.
- Site adoption ≈ 0; no mainstream agent consumes tools yet. That gap is the opportunity —
  and community configs also cover tools sites would never ship themselves (cross-site
  comparison, extraction, de-dark-patterned flows).
- **Open question to track:** WebMCP is gated to origin-isolated documents
  (`registerTool` rejects with `SecurityError` when the agent cluster isn't
  origin-keyed). The testing flag relaxes this — Joakim's extension works on arbitrary
  sites only with the flag on. Whether content-script registration keeps working when
  WebMCP ships stable is UNKNOWN. Watch/file issues at
  https://github.com/webmachinelearning/webmcp.

### Reference implementation (MIT — study and port from it)

Joakim Selemyr built a v0 of this exact idea; it's MIT-licensed and stale (last commits
March 2026, pre-dates the `document.modelContext` migration):

- https://github.com/Joakim-Sael/web-mcp-hub — hub server (Next.js + Drizzle + Supabase),
  config format, verification model, MCP server package
- https://github.com/Joakim-Sael/webmcp-extension — WXT extension that injects configs

**His config format:** `{ domain, urlPattern, title, description, tools[] }` where each
tool is `{ name, description, inputSchema, annotations?, execution? }`. `execution` is a
declarative DOM-automation descriptor — either *simple mode* (fill `fields[]` by CSS
selector, optional `autosubmit`, extract `resultSelector`) or *multi-step mode*
(`steps[]` of `navigate | click | fill | select | wait | extract | scroll | condition |
evaluate` with `{{param}}` templating). Input schemas can be derived from field
definitions.

**Executor tricks worth porting** (from his content script — hard-won details):
- Native prototype value setter to defeat React's value override on inputs
- Synthetic `ClipboardEvent("paste")` for Lexical/Draft rich-text editors (direct
  innerHTML bypasses their EditorState and submit buttons stay disabled)
- Shadow-DOM-deep `querySelector` traversal
- `:has-text("...")` pseudo-selector support
- Native `el.click()` so `isTrusted` is true (sites like X check this)

**What to do differently (his weaknesses):**
1. His `evaluate` step is arbitrary remote code execution in the user's logged-in page —
   **do not ship an evaluate step in v1** (or gate it behind per-config explicit user
   opt-in).
2. No config-rot defense. Ours must design for **canary testing** (CI re-runs configs
   against live sites and flags breakage) — leave room for health metadata in the schema.
3. His trust model is one-man manual verification. Adopt his **per-tool verification
   snapshot** idea (verified tools are snapshotted; later edits can't silently change
   what consumers receive; `yolo=true` exposes unverified configs) but design the schema
   for multi-reviewer later.
4. Handle conflicts with site-registered tools gracefully (skip + warn on name collision,
   both declarative `form[toolname]` and imperative).

## Repo & packages

- GitHub repo to create: `robertn702/webmcp-cafe` (public)
- Local path: `~/git/robertn702/webmcp-cafe`
- npm scope: `@robertn702` (all published packages)

```
webmcp-cafe/
├── apps/
│   ├── web/            # Next.js — registry UI + public REST API
│   └── extension/      # WXT — config lookup + tool injection
├── packages/
│   ├── schema/         # @robertn702/webmcp-cafe-schema — zod config format (published)
│   ├── db/             # Drizzle + Neon — schema + client
│   └── mcp/            # @robertn702/webmcp-cafe-mcp — MCP server (published)
└── (turbo + bun workspaces)
```

`packages/schema` is the keystone: web, extension, MCP server, and external contributors
all validate against the same published zod schemas. Version it; include a `minEngine`
field on configs so the format can evolve.

## Stack (all decided — do not relitigate)

- **Bun** (runtime + package manager, `packageManager` pinned) + **Turborepo**,
  TypeScript strict, ESM
- **Next.js + React 19 + Tailwind 4 + shadcn/ui** (shadcn is the standing default for
  Robert's new web projects; ecosystem: Radix, cva, tailwind-merge, lucide-react, sonner)
- **Public API:** Next route handlers + zod validation (NOT tRPC — consumers are
  third-party agents)
- **Postgres on Neon** via `@neondatabase/serverless` + **Drizzle ORM** (drizzle-kit
  migrations)
- **Auth: better-auth** — GitHub OAuth for humans + better-auth **API-key plugin** for
  agents (Bearer keys for config upload). Reference usage exists in the superset fork at
  `~/git/robertn702/superset/packages/auth` (upstream code, read-only reference).
- **zod v4** everywhere; `@t3-oss/env` for env vars
- **Vitest**; **ESLint + Prettier** (Robert's own-repo convention)
- **Changesets** for published packages
- MCP server: `@modelcontextprotocol/sdk` — expose tools like `lookup_config`,
  `list_configs`, `upload_config`, `update_config`, `vote_on_config` over the REST API;
  stdio mode for local MCP clients. Pattern after Robert's other MCP repos
  (`~/git/robertn702/copilot-money`, `~/git/robertn702/mcp-sunsama`).

## First: install project-local skills

Robert's rule: stack/domain skills are committed in-repo, never global. Run:

```bash
npx skills add shadcn/ui@shadcn -y
npx skills add better-auth/skills@better-auth-best-practices -y
npx skills add vercel-labs/agent-skills@vercel-react-best-practices -y
npx skills add browserbase/skills@webmcp-gen -y
npx skills add webmaxru/agent-skills@webmcp -y
```

(`browserbase/skills@webmcp-gen` generates WebMCP tool definitions for existing sites —
directly useful for config authoring.)

## Build sequence (milestone commits; each must build green)

1. **Scaffold** — git init, bun + turbo workspace, tsconfig base, ESLint/Prettier,
   skills (above), CI (GitHub Actions: typecheck + lint + test), initial commit, `gh repo
   create robertn702/webmcp-cafe --public --source . --push`. Write `AGENTS.md` capturing
   the essentials of this spec for future agents.
2. **packages/schema** — config format v1: zod schemas, input-schema derivation from
   field defs, urlPattern matching, validation tests. No `evaluate` step.
3. **apps/extension (spike)** — WXT extension reading configs from a local `configs/`
   dir (no server yet); `document.modelContext ?? navigator.modelContext` shim; executor
   ported from Joakim's MIT code (credit in README); 3–5 hand-authored read-only configs
   for sites Robert uses (confirm the site list with Robert). Verify manually on Chrome
   Canary/Dev with `#enable-webmcp-testing` + Model Context Tool Inspector extension.
4. **packages/db + apps/web** — Drizzle schema (configs, tools, users, api_keys, votes,
   verification snapshots), better-auth wiring, REST API (`GET /api/configs/lookup`,
   `GET/POST /api/configs`, `PATCH /api/configs/:id`, `POST /api/configs/:id/vote`,
   `GET /api/stats`; verified-only by default, `yolo=true` opt-in), minimal registry UI
   (browse, config detail, submit, API-key settings page).
5. **packages/mcp** — MCP server over the REST API.
6. **Polish** — verification flow UI, leaderboard, seed configs, README + docs.

## Credentials Robert must supply (use `.env.example` placeholders and proceed)

- `DATABASE_URL` — Neon project (Robert creates it; ask if missing when you reach step 4)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — OAuth app for better-auth (step 4)
- `BETTER_AUTH_SECRET`
- Vercel deploy + Chrome Web Store publishing come later — don't build for them yet.

## Conventions

- **No `as` type assertions** (except `as const`). Validate at boundaries with zod;
  narrow with runtime checks.
- Commit per milestone with conventional-commit-style messages; keep `main` green.
- Simplicity bias is a standing rule for Robert: ship the smallest version that works;
  no abstraction without a current requirement.
- Do not enter plan mode or block on interactive questions — make reasonable calls, note
  them in the commit message or AGENTS.md, and surface them in your final report.

## Out of scope for v1

Canary CI for config rot (design the schema for it, don't build it), multi-reviewer
verification, cross-browser extension builds, any monetization, official docs site.
