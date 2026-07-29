#!/usr/bin/env bash
set -euo pipefail

# Provision a fresh Paseo worktree for webmcp-today. Idempotent — runs on every
# workspace creation. Paseo runs this from a bare, non-interactive shell, so
# don't rely on inherited env vars.
#
# Paseo exposes the source checkout as $PASEO_SOURCE_CHECKOUT_PATH; fall back
# to deriving it from the git worktree list when run by hand.

MAIN_REPO="${PASEO_SOURCE_CHECKOUT_PATH:-$(git worktree list --porcelain | head -1 | sed 's/^worktree //')}"

# 1. Copy all .env* files from the main worktree (secrets stay out of git but
#    must exist in every worktree — e.g. apps/web/.env).
count=0
while IFS= read -r src; do
  rel="${src#"$MAIN_REPO"/}"
  dest="$PWD/$rel"
  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  echo "Copied $rel"
  count=$((count + 1))
done < <(find "$MAIN_REPO" -name ".env*" \
  -not -path "*/.git/*" \
  -not -path "*/node_modules/*" \
  -not -path "*/.superset/worktrees/*" \
  -not -path "*/.claude/worktrees/*" \
  -not -path "*/.conductor/worktrees/*" \
  -type f)
echo "Done — copied $count .env file(s)."

# 2. Copy .claude/settings.local.json if present in the main worktree.
CLAUDE_SETTINGS="$MAIN_REPO/.claude/settings.local.json"
if [[ -f "$CLAUDE_SETTINGS" ]]; then
  mkdir -p "$PWD/.claude"
  cp "$CLAUDE_SETTINGS" "$PWD/.claude/settings.local.json"
  echo "Copied .claude/settings.local.json"
fi

# 3. Symlink .scratch/shared from the main worktree so durable scratch state is
#    shared across workspaces; plain .scratch/ stays workspace-local (gitignored).
SHARED_SCRATCH="$MAIN_REPO/.scratch/shared"
if [[ -d "$SHARED_SCRATCH" ]]; then
  mkdir -p "$PWD/.scratch"
  ln -sfn "$SHARED_SCRATCH" "$PWD/.scratch/shared"
  echo "Linked .scratch/shared -> $SHARED_SCRATCH"
else
  echo "Skipping .scratch/shared symlink: $SHARED_SCRATCH not a directory"
fi

# 4. Symlink .vercel from the main worktree so the `vercel` CLI resolves the
#    linked project in every workspace (project/org ids only — no secrets;
#    .vercel is gitignored). Without it, every vercel command needs --cwd.
VERCEL_LINK="$MAIN_REPO/.vercel"
if [[ -d "$VERCEL_LINK" ]]; then
  ln -sfn "$VERCEL_LINK" "$PWD/.vercel"
  echo "Linked .vercel -> $VERCEL_LINK"
else
  echo "Skipping .vercel symlink: $VERCEL_LINK not a directory"
fi

# 5. Install dependencies, then build the workspace packages that consumers
#    resolve through dist/ (schema + mcp). dist/ is gitignored, so a fresh
#    worktree has none and every consumer fails with "Failed to resolve entry
#    for package @robertn702/webmcp-today-schema" until it is built. Scoped to
#    ./packages/* on purpose: apps/web's build needs real env vars (t3-env
#    validates at build) and is not needed to make the workspace usable.
if command -v bun >/dev/null 2>&1; then
  echo "Installing dependencies with bun..."
  bun install
  echo "Building workspace packages (dist/ consumers)..."
  bunx turbo run build --filter='./packages/*'
else
  echo "Skipping bun install: bun not found on PATH"
fi
