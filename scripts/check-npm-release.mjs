#!/usr/bin/env node
/* global process, console */
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Release gate for the npm trusted-publishing workflow
// (../.github/workflows/publish-npm.yml). Fails unless the `npm-v*` tag matches
// both publishable package versions exactly, the MCP bridge pins the same
// schema version, and both packages declare the expected name and repository —
// so a mislabeled, half-bumped, or re-pointed package can never reach npm.
//
// Args: <npm-v{version}> [repo-root] — repo-root defaults to cwd and exists so
// the script is testable against fixture directory layouts.

const SCHEMA_NAME = "@webmcp-today/schema";
const MCP_NAME = "@webmcp-today/mcp-bridge";
// Trusted publishing requires the exact, case-sensitive repository URL the
// package publishes from; npm rejects a non-matching one at publish time, so
// the gate compares exactly rather than pattern-matching (a prefix-smuggling
// URL like an attacker host + github.com/… would slip past a suffix lookahead).
const REPO_URL = "git+https://github.com/robertn702/webmcp-today.git";

const [releaseTag, repoRoot = process.cwd()] = process.argv.slice(2);

const TAG_RE = /^npm-v([0-9]+\.[0-9]+\.[0-9]+)$/;

function fail(message) {
  // Folded into the workflow run's checks; outside a GitHub runner it reads
  // like any other stderr line.
  process.stderr.write(`::error::${message}\n`);
  process.exit(1);
}

if (!releaseTag) {
  fail("usage: check-npm-release.mjs <npm-v{version}> [repo-root]");
}

const match = TAG_RE.exec(releaseTag);
if (!match) {
  fail(`tag "${releaseTag}" is not a valid npm release tag (expected npm-v<semver>)`);
}
const version = match[1];

const readPkg = (pkgPath) => {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(repoRoot, pkgPath), "utf8"));
  } catch (error) {
    fail(`cannot read ${pkgPath}: ${error.message}`);
  }
  return pkg;
};

const schemaPkg = readPkg("packages/schema/package.json");
const mcpPkg = readPkg("packages/mcp/package.json");

if (schemaPkg.name !== SCHEMA_NAME) {
  fail(`packages/schema/package.json name is ${schemaPkg.name}, expected ${SCHEMA_NAME}`);
}
if (mcpPkg.name !== MCP_NAME) {
  fail(`packages/mcp/package.json name is ${mcpPkg.name}, expected ${MCP_NAME}`);
}

// Trusted publishing only works when package.json's repository.url matches the
// GitHub repository; a custom publishConfig.registry would publish elsewhere.
for (const [pkgPath, pkg] of [
  ["packages/schema/package.json", schemaPkg],
  ["packages/mcp/package.json", mcpPkg],
]) {
  if (pkg.repository?.url !== REPO_URL) {
    fail(`${pkgPath} repository.url ${pkg.repository?.url ?? "(missing)"} must be ${REPO_URL}`);
  }
  if (pkg.publishConfig?.registry) {
    fail(`${pkgPath} sets publishConfig.registry — packages must publish to registry.npmjs.org`);
  }
}

if (schemaPkg.version !== version) {
  fail(
    `tag ${releaseTag} does not match packages/schema/package.json version ${schemaPkg.version}`,
  );
}
if (mcpPkg.version !== version) {
  fail(`tag ${releaseTag} does not match packages/mcp/package.json version ${mcpPkg.version}`);
}

// The bridge installs against the exact schema version, so it must be in the
// registry before the bridge's dependency resolves. Pin, never a range.
const schemaDep = mcpPkg.dependencies?.["@webmcp-today/schema"];
if (schemaDep !== version) {
  fail(
    `packages/mcp/package.json must depend on the exact @webmcp-today/schema version being released (${version}), got ${
      schemaDep ?? "no dependency"
    }`,
  );
}

console.log(`ok: ${releaseTag} matches packages/schema, packages/mcp, and the bridge's schema pin`);
