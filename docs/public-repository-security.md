# Public Repository Security Record and Audit

Initial-publication record and reusable audit for this public repository. The
publication record and remaining checks are retained here so future audits can
recheck GitHub and deployment settings that cannot be enforced by a repository
commit. The controlled non-team fork and Vercel test remains outstanding.

## Initial-publication record

1. Confirm `SECURITY.md` is present on `main` and the existing Actions workflows
   have been hardened before publication.
2. Re-run the publication-safety audit against the exact commit that will become
   public. Include Git history, issues, pull requests, Actions logs and
   artifacts, releases, repository variables, and public-facing documentation.
   Delete or redact sensitive Actions logs and artifacts before the visibility
   change: GitHub makes existing Actions history and logs public with the
   repository.
3. In Vercel Project Settings > Security, confirm Git Fork Protection is enabled.
   The controlled non-team fork and Vercel deployment test remains outstanding; do
   not treat this initial record as evidence that it passed.

## GitHub security controls

1. After a visibility change, GitHub enables public-repository GitHub Advanced
   Security features. Do not treat that as evidence that every feature below is
   configured.
2. Open Settings > Code security and analysis. Enable the dependency
   graph if it is not already enabled, Dependabot alerts, Dependabot security
   updates, automated security fixes, secret scanning, and push protection for
   supported secrets. This project intentionally does not configure Dependabot
   version-update pull requests; alerts and security updates do not require it.
3. Enable private vulnerability reporting. Verify that the **Report a
   vulnerability** control is visible in the repository Security tab and that
   `https://github.com/robertn702/webmcp-today/security/policy` renders
   `SECURITY.md`.
4. Enable CodeQL default setup for JavaScript/TypeScript, then wait for its
   first default-branch run. Confirm the Security tab shows active CodeQL
   analysis. Triage every initial alert rather than dismissing it in bulk.
5. Wait for secret scanning's historical scan to complete. Review every alert;
   if an alert is a real credential, revoke or rotate it before resolving the
   alert. Treat a historical finding as an incident even if the relevant commit
   has already been removed. Verify push protection blocks a deliberately
   generated supported test pattern only if GitHub's documented test procedure
   is available; never push a real credential to test it.

## Repository And Deployment Protections

1. Verify `main` and `extension-v*` rulesets after a visibility change. GitHub
   disables all push rulesets during a private-to-public conversion, so confirm
   their enforcement state after the change. Require pull requests,
   the CI check, and protection from force pushes or deletion for `main`; restrict
   creation, update, and deletion of `extension-v*` tags to the release owner.
2. Confirm default GitHub Actions workflow permissions remain read-only and that
   Actions cannot approve pull-request reviews. As of this audit, both settings
   are already correct.
3. From a non-team GitHub account, fork the public repository and open a harmless
   pull request that changes only documentation. Confirm ordinary GitHub CI runs
   without repository secrets. Confirm Vercel leaves the Preview deployment
   unbuilt or blocked pending explicit authorization; approve only after
   inspecting the exact fork commit. Record the PR URL and result in the
   pre-release checklist, then close the test PR without merging.

## Reusable audit record

For the initial publication, record the date, actor, links to the first CodeQL
run and reviewed secret scan, alert counts and dispositions, ruleset names, and
the controlled fork PR result in the release checklist. For later audits, record
the same evidence for the reviewed change. Recheck GitHub and Vercel settings
after the test because these controls are service configuration, not versioned
code.
