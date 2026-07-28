# Contributing

Issues and pull requests are welcome. Before opening a PR:

```bash
bun install
bun run typecheck && bun run lint && bun run test
```

Use conventional commits (`feat:`, `fix:`, `chore:`, …). Repo conventions live in `AGENTS.md` — worth a skim before any structural change.

## Licensing of contributions

This repo is split-licensed (see [README](README.md#license)). Your contribution is offered under the license of the part you touch: **AGPL-3.0-only** for `apps/web` and `packages/db`, **MIT** for `packages/schema`, `packages/mcp`, `packages/curated-packages`, and `apps/extension`.

## Contributor license agreement

By submitting a contribution — code, docs, configs, anything merged into this repo — you agree that:

1. You grant Robert Niimi a perpetual, worldwide, irrevocable, royalty-free, non-exclusive license to use, reproduce, modify, distribute, sublicense, and **relicense your contribution under any terms**, including proprietary or commercial ones. This includes a license to any patents you hold that your contribution necessarily infringes.
2. You keep your copyright. This is a license, not an assignment — you can still use your own work however you want, including in other projects.
3. The contribution is yours to give: you wrote it, or you otherwise have the right to submit it, and it doesn't knowingly infringe someone else's rights.
4. If you're contributing as part of a job, you have your employer's permission.

Why this exists: it preserves the option to relicense the server later — for example to offer a commercial or hosted version — without tracking down every past contributor. It takes nothing away from what you can do with your own code.

No signing ceremony. Opening a pull request is your agreement to the above.
