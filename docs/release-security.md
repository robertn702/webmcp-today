# Release Security Runbook

The extension ZIP release workflow is a release trust boundary. It re-runs the
test suite on a tag, builds the ZIP, and creates or updates the GitHub Release.
The workflow pins every action to an immutable full commit SHA and grants its
`GITHUB_TOKEN` `contents: write` only in the one job that uploads release
assets.

## Checksum scope

`SHA256SUMS` lets a downloader check that the ZIP bytes they downloaded match
the ZIP bytes attached to that GitHub Release:

```bash
sha256sum --check --strict SHA256SUMS
```

It is generated and uploaded by the same workflow as the ZIP. It detects a
corrupt or mismatched download, but is not a detached signature and does not
independently authenticate the publisher. Publisher identity currently relies
on GitHub's repository and release controls. Do not describe this file as a
signature.

Do not add a signing step until there is a separately protected signing key and
a documented way for users to obtain and verify its public key. A signature
published only beside the ZIP would not add an independent trust root.

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
   `actions/*`, `oven-sh/setup-bun`, `neondatabase/delete-branch-action`, and
   `softprops/action-gh-release`; then enable **Require actions to be pinned to
   a full-length commit SHA**. The workflows already use full SHAs, with the
   reviewed release version documented on each line.
3. Create an active `main` branch ruleset. Require pull requests, require the
   `ci` status check, and block branch deletion and force pushes. Give bypass
   access only to the repository owner or an explicitly designated release
   administrator.
4. Create an active tag ruleset targeting `extension-v*`. Block tag creation,
   updates, and deletion for everyone except the repository owner or an
   explicitly designated release administrator. This prevents an unreviewed
   tag from invoking the release workflow or changing a published tag's source.
5. Create a protected `extension-release` environment with a required reviewer
   and move `WXT_EXTENSION_KEY` there only if the release process can tolerate
   an approval gate. This is a defense in depth measure for the release
   identity; the release workflow remains functional without it.
6. Trigger a release from a disposable, protected test tag only after the
   rulesets are active. Confirm its run completes tag/version validation,
   typecheck, lint, tests, ZIP generation, checksum verification, and release
   upload. Delete the test release and tag only under the applicable release
   procedure.

After changing these settings, inspect the Actions configuration and rulesets
from the repository UI or API. Do not treat the presence of SHA pins in Git as
proof that GitHub's Actions policy or ref protections are enabled.
