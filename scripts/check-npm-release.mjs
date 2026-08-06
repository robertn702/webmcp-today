#!/usr/bin/env node
/* global process, console */
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Release gate for the npm trusted-publishing workflow
// (../.github/workflows/publish-npm.yml). A `schema-v*` tag validates the
// schema package alone. An `mcp-v*` tag validates the bridge version and exact
// schema pin, plus both package identities and publication settings.
//
// Args: <schema-v{version}|mcp-v{version}> [repo-root] — repo-root defaults to
// cwd and exists so the script is testable against fixture directory layouts.

const SCHEMA_NAME = "@webmcp-today/schema";
const MCP_NAME = "@webmcp-today/mcp-bridge";
// Trusted publishing requires the exact, case-sensitive repository URL the
// package publishes from; npm rejects a non-matching one at publish time, so
// the gate compares exactly rather than pattern-matching (a prefix-smuggling
// URL like an attacker host + github.com/… would slip past a suffix lookahead).
const REPO_URL = "git+https://github.com/robertn702/webmcp-today.git";

const [releaseTag, repoRoot = process.cwd()] = process.argv.slice(2);

const TAG_RE = /^(schema|mcp)-v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

function fail(message) {
  // Folded into the workflow run's checks; outside a GitHub runner it reads
  // like any other stderr line.
  process.stderr.write(`::error::${message}\n`);
  process.exit(1);
}

if (!releaseTag) {
  fail("usage: check-npm-release.mjs <schema-v{version}|mcp-v{version}> [repo-root]");
}

const match = TAG_RE.exec(releaseTag);
if (!match) {
  fail(
    `tag "${releaseTag}" is not a valid npm release tag (expected schema-v<semver> or mcp-v<semver>)`,
  );
}
const [, target, major, minor, patch] = match;
const version = `${major}.${minor}.${patch}`;

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

if (schemaPkg.name !== SCHEMA_NAME) {
  fail(`packages/schema/package.json name is ${schemaPkg.name}, expected ${SCHEMA_NAME}`);
}
const validatePackagePublishConfig = (pkgPath, pkg) => {
  // Trusted publishing only works when package.json's repository.url matches
  // the GitHub repository; a custom publishConfig.registry would publish
  // elsewhere.
  if (pkg.repository?.url !== REPO_URL) {
    fail(`${pkgPath} repository.url ${pkg.repository?.url ?? "(missing)"} must be ${REPO_URL}`);
  }
  if (pkg.publishConfig?.registry) {
    fail(`${pkgPath} sets publishConfig.registry — packages must publish to registry.npmjs.org`);
  }
};

validatePackagePublishConfig("packages/schema/package.json", schemaPkg);

if (target === "schema") {
  if (schemaPkg.version !== version) {
    fail(
      `tag ${releaseTag} does not match packages/schema/package.json version ${schemaPkg.version}`,
    );
  }
  console.log(`ok: ${releaseTag} matches packages/schema`);
  process.exit(0);
}

const mcpPkg = readPkg("packages/mcp/package.json");

if (mcpPkg.name !== MCP_NAME) {
  fail(`packages/mcp/package.json name is ${mcpPkg.name}, expected ${MCP_NAME}`);
}
validatePackagePublishConfig("packages/mcp/package.json", mcpPkg);

if (mcpPkg.version !== version) {
  fail(`tag ${releaseTag} does not match packages/mcp/package.json version ${mcpPkg.version}`);
}

// The bridge installs against an exact schema version, which may differ from
// the bridge release version and must already be in the registry.
const schemaDep = mcpPkg.dependencies?.["@webmcp-today/schema"];
if (!/^\d+\.\d+\.\d+$/.test(schemaDep ?? "")) {
  fail(
    `packages/mcp/package.json must depend on an exact @webmcp-today/schema version, got ${
      schemaDep ?? "no dependency"
    }`,
  );
}

console.log(`ok: ${releaseTag} matches packages/mcp and the bridge's schema pin`);
