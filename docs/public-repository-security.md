# Public Repository Security Runbook

Run this during the repository visibility change, before announcing the public
beta. These controls cannot be enabled safely by a repository commit while this
repository is private on its current plan.

## Before making the repository public

1. Merge the repository controls for #101 and #100. Confirm `SECURITY.md` and
   `.github/dependabot.yml` are present on `main`; #100 separately hardens the
   existing Actions workflows.
2. Re-run the publication-safety audit against the exact commit that will become
   public. Include Git history, issues, pull requests, Actions logs and
   artifacts, releases, repository variables, and public-facing documentation.
   Delete or redact sensitive Actions logs and artifacts before the visibility
   change: GitHub makes existing Actions history and logs public with the
   repository.
3. In Vercel Project Settings > Security, confirm Git Fork Protection is enabled.
   Do not authorize fork deployment requests as part of this preflight.

## Visibility Flip And GitHub Security

1. Change the repository visibility to public in GitHub Settings > General.
   GitHub enables public-repository GitHub Advanced Security features after the
   change; do not treat that as evidence that every feature below is configured.
2. Immediately open Settings > Code security and analysis. Enable the dependency
   graph if it is not already enabled, Dependabot alerts, Dependabot security
   updates, automated security fixes, secret scanning, and push protection for
   supported secrets. The committed `dependabot.yml` adds weekly Bun workspace
   version updates; it does not turn on vulnerability alerts or security updates.
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

1. Apply the `main` and `extension-v*` rulesets specified by #100 after the
   visibility flip. GitHub disables all push rulesets during a private-to-public
   conversion, so create or re-enable them only after the change and verify
   their enforcement state. This runbook does not replace #100's Actions
   allowlist, SHA-pinning, release-permission, or tag-protection work.
2. Confirm default GitHub Actions workflow permissions remain read-only and that
   Actions cannot approve pull-request reviews. As of this audit, both settings
   are already correct.
3. From a non-team GitHub account, fork the public repository and open a harmless
   pull request that changes only documentation. Confirm ordinary GitHub CI runs
   without repository secrets. Confirm Vercel leaves the Preview deployment
   unbuilt or blocked pending explicit authorization; approve only after
   inspecting the exact fork commit. Record the PR URL and result in the
   pre-release checklist, then close the test PR without merging.

## Completion Record

Record the date, the actor, links to the first CodeQL run and reviewed secret
scan, alert counts and dispositions, ruleset names, and the controlled fork PR
result in the pre-release checklist. Recheck GitHub and Vercel settings after
the test because these controls are service configuration, not versioned code.
