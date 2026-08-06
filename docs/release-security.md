# Release Security Runbook

Two release trust boundaries exist in this repository.

The extension ZIP workflow (`.github/workflows/release-extension.yml`) re-runs
the test suite on an `extension-v*` tag, builds the ZIP, and creates or updates
the GitHub Release. It pins every action to an immutable full commit SHA and
grants its `GITHUB_TOKEN` `contents: write` only in the one job that uploads
release assets.

The npm publication workflow (`.github/workflows/publish-npm.yml`) re-runs the
test suite on an `npm-v*` tag and publishes `@webmcp-today/schema` then
`@webmcp-today/mcp-bridge` to npm. It authenticates through GitHub Actions OIDC
Trusted Publishing, so no npm token exists anywhere in the repository or
environment, and npm records publish provenance automatically. The publish job
holds only `contents: read` and `id-token: write`, and every action is pinned
to a full commit SHA.

## Checksum scope

`SHA256SUMS` lets a downloader check that the ZIP bytes they downloaded match
the ZIP bytes attached to that GitHub Release:

```bash
sha256sum --check --strict --ignore-missing SHA256SUMS
```

It is generated and uploaded by the same workflow as the ZIP. It detects a
corrupt or mismatched download, but is not a detached signature and does not
independently authenticate the publisher. Publisher identity currently relies
on GitHub's repository and release controls. Do not describe this file as a
signature.

Do not add a signing step until there is a separately protected signing key and
a documented way for users to obtain and verify its public key. A signature
published only beside the ZIP would not add an independent trust root.

## npm Trusted Publishing

Cut an `npm-v*` tag only from a reviewed, merged release commit whose
`packages/schema` and `packages/mcp` versions match the tag and whose bridge
pins that exact schema version. `scripts/check-npm-release.mjs` enforces all
three and fails the run otherwise — the manual half is just pushing the tag.
Published package versions are derived from the tag, so the version bump PR and
the tag must move together.

Authentication is GitHub Actions OIDC Trusted Publishing. The publish job
mints a short-lived npm identity from GitHub's OIDC on each run; npm records
publish provenance automatically. npm requires a GitHub-hosted runner with npm
CLI 11.5.1 or newer **and Node 22.14.0 or newer**; the workflow pins both
(`npm@11.5.1` installed globally, `actions/setup-node` with Node 24). Its
`setup-node` step deliberately sets no `registry-url`, because the empty
`_authToken` it would write to `~/.npmrc` suppresses npm's OIDC fallback.
Do not add `NODE_AUTH_TOKEN`, an npm token, `--otp`, or a `--provenance` flag
to the publish steps — the trust relationship, not a secret, is the credential.

The workflow refuses `workflow_dispatch` unless it runs from the release tag
itself (`github.ref_type` must be `tag` and the ref must equal the `tag`
input). That guard is defense in depth only: a modified copy of the workflow
on a branch can remove it, so the authoritative barrier is the `npm-publish`
environment's deployment scope — restrict the environment to deploy **only
from `npm-v*` tags, no branches, with admin bypass disabled** (Settings →
Environments → `npm-publish` → Deployment branches → "Selected branches and
tags"). An unreviewed branch copy of the workflow never reaches the
environment, and the required reviewer is the last line of defense for a
legitimate tag run. Review the exact workflow file being executed before
approving any run.

### Partial-publication recovery

npm publishes are immutable per version, so a run that published schema but
failed the bridge cannot just be re-run on the same tag (schema republish
fails). Re-run the tag with the `packages: mcp` dispatch input: the schema
publish is skipped and a guard fails loudly unless
`@webmcp-today/schema@<tag version>` is already on the registry. Diagnose the
bridge failure from that run's logs, then re-run `packages: mcp` on the same
immutable tag.

### One-time npm Trusted Publisher configuration

Configure a Trusted Publisher per package on npmjs.com (the `npm trust` flow if
the installed CLI supports it). The relationship is package-scoped, so do it
for both `@webmcp-today/schema` and `@webmcp-today/mcp-bridge`:

- Provider: GitHub Actions
- Organization/user: `robertn702`
- Repository: `webmcp-today`
- Workflow filename: `publish-npm.yml` — must match exactly, `.yml` and all
- Environment: `npm-publish` — the publish job declares the same
  environment, and npm includes it in the OIDC subject it checks
- Permitted action: `npm publish`

If the workflow filename, environment, owner, or repository in the trust record
ever diverges from the workflow, publishes fail with an OIDC authentication
error. Change the workflow, the npm records, and this runbook together.

## GitHub Settings After Public Visibility

This private repository's current plan rejects branch-protection configuration
with `Upgrade to GitHub Pro or make this repository public`. Immediately after
changing visibility, configure and verify the following in GitHub. These are
repository settings, not versioned files, so this runbook is the source of
record for the manual work.

1. In **Settings → Actions → General**, retain the default `GITHUB_TOKEN`
   permission as **Read repository contents** and keep **Allow GitHub Actions
   to create and approve pull requests** disabled.
2. In the same Actions settings, change **Actions permissions** from allowing
   all actions to **Allow select actions and reusable workflows**. Permit only
   `actions/*`, `oven-sh/setup-bun`, and `softprops/action-gh-release`; then
   enable **Require actions to be pinned to a full-length commit SHA**. The
   workflows already use full SHAs, with the reviewed release version documented
   on each line. Review Dependabot action updates before merging; adding a new
   action also requires an allowlist update in that same reviewed change.
3. Create an active `main` branch ruleset. Require pull requests, require the
   `ci` status check, and block branch deletion and force pushes. Give bypass
   access only to the repository owner or an explicitly designated release
   administrator.
4. Create active tag rulesets targeting `extension-v*` and `npm-v*`. Block tag
   creation, updates, and deletion for everyone except the repository owner or
   an explicitly designated release administrator. This prevents an unreviewed
   tag from invoking the release workflows or changing a published tag's source.
   Do not allow force-updating a release tag.
5. Create a protected `extension-release` environment with a required reviewer
   and move `WXT_EXTENSION_KEY` there only if the release process can tolerate
   an approval gate. In the same change, add `environment: extension-release`
   to the release job so `vars.WXT_EXTENSION_KEY` resolves from that environment.
   This is a defense in depth measure for the release identity; the release
   workflow remains functional without it.
6. Create a protected `npm-publish` environment. Enable **Required reviewers**
   (single release maintainer), **Prevent self-review**, and deselect **Allow
   administrators to bypass configured protection rules**. In **Deployment
   branches → Selected branches and tags**, add one **Tag** rule matching
   `npm-v*` and no branch rules, so only release tags can deploy to it. The
   npm publish job already declares `environment: npm-publish`, and the npm
   Trusted Publisher records reference the same name. Do not store an npm token
   there; OIDC is the credential path. Approve a run only after inspecting the
   tag, commit, checks, package versions, and intended npm package targets.
7. Trigger a release from a disposable, protected test tag only after the
   rulesets are active. Confirm its run completes tag/version validation,
   typecheck, lint, tests, ZIP generation, checksum verification, and release
   upload. Delete the test release and tag only under the applicable release
   procedure. For npm, exercise the same gates tokenlessly with a
   `workflow_dispatch` `dry-run` onto a disposable `npm-v*` tag before the
   first real publish. `npm publish --dry-run` packs (running the `prepack`
   build) without uploading, so it proves checkout, install, the release
   gates, and packaging — but it does **not** exercise the OIDC trust
   relationship, and npm does not verify a Trusted Publisher configuration
   until a real publish attempts authentication. Treat the first real publish
   as the trust verification: publish a single deliberate release, then
   confirm `npm view @webmcp-today/schema@<v>` and
   `npm view @webmcp-today/mcp-bridge@<v>` resolve and both carry provenance.
   The `packages: mcp` recovery input covers the schema-published /
   bridge-failed mid-state.

After changing these settings, inspect the Actions configuration and rulesets
from the repository UI or API. Do not treat the presence of SHA pins in Git as
proof that GitHub's Actions policy or ref protections are enabled.
