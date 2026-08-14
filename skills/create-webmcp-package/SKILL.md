---
name: create-webmcp-package
description: Create or repair declarative WebMCP Today package JSON by researching a website's HTTP API, validating webmcp-package.json, and safely replaying an exact read-only request. Use for WebMCP Today registry packages only. Do not use for native document.modelContext integration, DOM automation, server-side MCP servers, or publishing an already-reviewed package.
compatibility: "Requires Node 20+, network access, and browser network inspection when the target API is undocumented."
license: MIT
---

# Create A WebMCP Today Package

Produce a validated `webmcp-package.json` in the user's workspace and prove one exact harmless read request. Stop before registry publication.

## Workflow

1. Identify the target website URL and the single useful capability to expose first. Start with one read-only tool.
2. Read the current package-format reference at <https://webmcp.today/docs/package-format> before authoring. The skill's pinned validator is authoritative for whether the resulting package is valid.
3. Read `references/api-research.md` before researching an undocumented API, using browser network inspection, handling login/CSRF, or replaying a live request.
4. Prefer an official HTTP API. Otherwise observe the site's own frontend requests and document the evidence. Do not substitute DOM selectors, page scripts, or arbitrary browser automation for an API.
5. Read `assets/minimal-readonly-package.json` when starting a new package or when the required top-level shape is unclear. Adapt it; do not copy its example domain unchanged.
6. Create `webmcp-package.json` in the user's current workspace, not in this skill directory.
7. Find the directory containing this `SKILL.md` and treat it as `SKILL_DIR`. If `SKILL_DIR/node_modules/@webmcp-today/schema` is absent, run `npm ci --prefix "$SKILL_DIR" --ignore-scripts`. Never assume the user is working in a clone of WebMCP Today.
8. Validate from any directory with `node "$SKILL_DIR/scripts/validate.mjs" "$PWD/webmcp-package.json"`. Fix every issue and rerun until it succeeds.
9. Derive the exact request from the validated endpoint and representative input, including every attached auth-source fetch. Replay only when the full request chain is harmless and reproducible by the executor. Show the method, fully resolved URL/query, credential mode, redirect behavior, and generated non-secret headers. Never execute a write for testing.
10. Show the final JSON, exact redacted request, and concise live result. State any API assumptions or untested authenticated behavior.
11. Stop. Do not submit, publish, accept registry terms, create an API key, or call a registry write endpoint. Publishing is a separate consent, legal, and write workflow.

## Critical Constraints

- Packages use API execution only: every tool has `execution: { "mode": "api", "endpoint": "..." }`.
- Set `version` to `1` for a new package and `minEngine` to `1`. Package versions are author-declared integers; they are unrelated to this skill's distribution or `npx skills` updates.
- Prefix each tool name for its site, keep it at most 30 characters, and use only letters, digits, `_`, and `-`, starting with a letter.
- Keep `inputSchema` a flat object of primitive string, number, integer, or boolean properties. Use `additionalProperties: false`.
- Every `{{param}}` placeholder must match a property of each bound tool's input schema.
- Use JMESPath for `returns`. Use locator arrays such as `["json", "errors"]` for `errorPath` and `["data", "csrf"]` for auth `extract`.
- An endpoint may declare at most one of `body`, `form`, or `graphql`; a `GET` declares none.
- Make annotations honest. Set `readOnlyHint: true` only when the endpoint and every attached auth-source fetch cannot modify server or user state. Mark destructive tools honestly when authoring or repairing them.
- Never live-test `POST`, `PUT`, `PATCH`, `DELETE`, vote/action `GET`s, or any request that may mutate state. A declarative write may be validated without being invoked.
- Never print or save credentials, bearer tokens, API keys, cookies, CSRF values, session headers, or unredacted copied requests.
- Do not claim support for required static headers: the current format sends generated content-type headers plus headers injected by declared auth sources only.
- Every executor request rejects redirects. Treat any observed redirect as unsupported; do not follow it when validating a package.
- Keep `api.baseUrl` on the package domain or its subdomain. Do not weaken, proxy around, or fabricate cross-origin support.
- The sole current unrelated-origin exception is anonymous `GET` reads from `https://hacker-news.firebaseio.com`, with no auth, omitted cookies/credentials, and rejected redirects. Refuse unsupported unrelated API origins.

## Completion Checklist

- `webmcp-package.json` exists in the user's workspace.
- The pinned validator exits successfully.
- One exact harmless read request was replayed, or a concrete safety/access limitation is reported.
- Final output includes the JSON, redacted request, result, and assumptions.
- No publication occurred.
