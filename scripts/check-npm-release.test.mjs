/* global process */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// The check script exits the process on a failed gate, so it runs in a child
// process rather than being imported into this one.
const SCRIPT = join(import.meta.dirname, "check-npm-release.mjs");
const WORKFLOW = join(import.meta.dirname, "../.github/workflows/publish-npm.yml");

const tmpRepos = [];

const REPO_URL = "git+https://github.com/robertn702/webmcp-today.git";

function makeRepo({
  schemaName = "@webmcp-today/schema",
  mcpName = "@webmcp-today/mcp-bridge",
  schemaVersion = "1.2.3",
  mcpVersion = "1.2.3",
  schemaDep = "1.2.3",
  schemaRegistry,
  mcpRegistry,
  repoUrl = REPO_URL,
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), "npm-release-check-"));
  tmpRepos.push(dir);
  mkdirSync(join(dir, "packages/schema"), { recursive: true });
  mkdirSync(join(dir, "packages/mcp"), { recursive: true });
  writeFileSync(
    join(dir, "packages/schema/package.json"),
    JSON.stringify({
      name: schemaName,
      version: schemaVersion,
      repository: { type: "git", url: repoUrl },
      publishConfig: schemaRegistry
        ? { registry: schemaRegistry, access: "public" }
        : { access: "public" },
    }),
  );
  writeFileSync(
    join(dir, "packages/mcp/package.json"),
    JSON.stringify({
      name: mcpName,
      version: mcpVersion,
      repository: { type: "git", url: repoUrl },
      publishConfig: mcpRegistry
        ? { registry: mcpRegistry, access: "public" }
        : { access: "public" },
      dependencies: schemaDep === null ? {} : { "@webmcp-today/schema": schemaDep },
    }),
  );
  return dir;
}

function run(tag, repoDir) {
  return spawnSync(process.execPath, [SCRIPT, tag, repoDir], { encoding: "utf8" });
}

test("accepts a schema tag independent of MCP version and schema pin", () => {
  const { status, stdout } = run(
    "schema-v1.2.3",
    makeRepo({ mcpVersion: "4.5.6", schemaDep: "4.5.5" }),
  );
  assert.equal(status, 0);
  assert.match(stdout, /ok:/);
});

test("accepts a schema tag without an MCP package", () => {
  const repoDir = makeRepo();
  rmSync(join(repoDir, "packages/mcp"), { recursive: true, force: true });
  const { status, stdout } = run("schema-v1.2.3", repoDir);
  assert.equal(status, 0);
  assert.match(stdout, /ok:/);
});

test("accepts an MCP tag independent of schema version", () => {
  const { status, stdout } = run(
    "mcp-v4.5.6",
    makeRepo({ schemaVersion: "1.2.3", mcpVersion: "4.5.6", schemaDep: "1.2.3" }),
  );
  assert.equal(status, 0);
  assert.match(stdout, /ok:/);
});

test("rejects a tag with an unsupported release target", () => {
  const { status, stderr } = run("extension-v1.0.0", makeRepo());
  assert.notEqual(status, 0);
  assert.match(stderr, /not a valid npm release tag/);
});

test("rejects a truncated semver in the tag", () => {
  const { status } = run("schema-v1.2", makeRepo());
  assert.notEqual(status, 0);
});

test("rejects a tag with leading zero semver components", () => {
  const { status } = run("schema-v01.2.3", makeRepo());
  assert.notEqual(status, 0);
});

test("rejects a schema tag/version mismatch", () => {
  const { status, stderr } = run("schema-v1.2.3", makeRepo({ schemaVersion: "1.2.4" }));
  assert.notEqual(status, 0);
  assert.match(stderr, /packages\/schema/);
});

test("rejects an MCP tag/version mismatch", () => {
  const { status, stderr } = run("mcp-v1.2.3", makeRepo({ mcpVersion: "1.2.4" }));
  assert.notEqual(status, 0);
  assert.match(stderr, /packages\/mcp/);
});

test("rejects an unpinned schema dependency", () => {
  const { status, stderr } = run("mcp-v1.2.3", makeRepo({ schemaDep: "^1.2.3" }));
  assert.notEqual(status, 0);
  assert.match(stderr, /exact @webmcp-today\/schema version/);
});

test("rejects a missing schema dependency", () => {
  const { status, stderr } = run("mcp-v1.2.3", makeRepo({ schemaDep: null }));
  assert.notEqual(status, 0);
  assert.match(stderr, /exact @webmcp-today\/schema version/);
});

test("rejects an unexpected schema package name", () => {
  const { status, stderr } = run("schema-v1.2.3", makeRepo({ schemaName: "@evil/schema" }));
  assert.notEqual(status, 0);
  assert.match(stderr, /packages\/schema\/package\.json name/);
});

test("rejects an unexpected bridge package name", () => {
  const { status, stderr } = run("mcp-v1.2.3", makeRepo({ mcpName: "@evil/mcp-bridge" }));
  assert.notEqual(status, 0);
  assert.match(stderr, /packages\/mcp\/package\.json name/);
});

test("rejects a repository.url that does not match the GitHub repository", () => {
  const { status, stderr } = run(
    "mcp-v1.2.3",
    makeRepo({ repoUrl: "git+https://github.com/evil/webmcp-today.git" }),
  );
  assert.notEqual(status, 0);
  assert.match(stderr, /repository\.url/);
});

test("rejects a repository.url that smuggles the repo inside another host", () => {
  const { status, stderr } = run(
    "mcp-v1.2.3",
    makeRepo({ repoUrl: "git+https://evil.example/github.com/robertn702/webmcp-today.git" }),
  );
  assert.notEqual(status, 0);
  assert.match(stderr, /repository\.url/);
});

test("rejects a repository.url with a dropped .git suffix", () => {
  const { status, stderr } = run(
    "mcp-v1.2.3",
    makeRepo({ repoUrl: "git+https://github.com/robertn702/webmcp-today" }),
  );
  assert.notEqual(status, 0);
  assert.match(stderr, /repository\.url/);
});

test("rejects a custom publishConfig.registry", () => {
  const { status, stderr } = run(
    "mcp-v1.2.3",
    makeRepo({ mcpRegistry: "https://evil.example.com" }),
  );
  assert.notEqual(status, 0);
  assert.match(stderr, /publishConfig\.registry/);
});

test("rejects a custom schema publishConfig.registry on an MCP release", () => {
  const { status, stderr } = run(
    "mcp-v1.2.3",
    makeRepo({ schemaRegistry: "https://evil.example.com" }),
  );
  assert.notEqual(status, 0);
  assert.match(stderr, /publishConfig\.registry/);
});

test("rejects a missing package layout", () => {
  const dir = mkdtempSync(join(tmpdir(), "npm-release-check-"));
  tmpRepos.push(dir);
  const { status } = run("schema-v1.2.3", dir);
  assert.notEqual(status, 0);
});

test("requires a tag argument", () => {
  const { status, stderr } = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.notEqual(status, 0);
  assert.match(stderr, /usage:/);
});

test("workflow uses independent immutable package release paths", () => {
  const workflow = readFileSync(WORKFLOW, "utf8");

  assert.match(workflow, /tags: \["schema-v\*", "mcp-v\*"\]/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /RELEASE_TAG: \$\{\{ github\.ref_name \}\}/);
  assert.match(
    workflow,
    /Build schema for publish[\s\S]*if: startsWith\(github\.ref_name, 'schema-v'\)/,
  );
  assert.match(
    workflow,
    /Build MCP bridge for publish[\s\S]*if: startsWith\(github\.ref_name, 'mcp-v'\)/,
  );
  assert.match(
    workflow,
    /Publish @webmcp-today\/schema[\s\S]*if: startsWith\(github\.ref_name, 'schema-v'\)/,
  );
  assert.match(
    workflow,
    /Publish @webmcp-today\/mcp-bridge[\s\S]*if: startsWith\(github\.ref_name, 'mcp-v'\)/,
  );

  const schemaCheck = workflow.indexOf("Verify MCP schema dependency is already published");
  const artifactCheck = workflow.indexOf(
    "Verify packed MCP bridge resolves its registry schema dependency",
  );
  const mcpPublish = workflow.indexOf("Publish @webmcp-today/mcp-bridge");
  assert.ok(schemaCheck >= 0 && schemaCheck < artifactCheck && artifactCheck < mcpPublish);
  assert.match(artifactCheck >= 0 ? workflow.slice(artifactCheck, mcpPublish) : "", /npm pack/);
  assert.match(
    artifactCheck >= 0 ? workflow.slice(artifactCheck, mcpPublish) : "",
    /npm install --prefix .*--ignore-scripts/,
  );
  assert.match(
    artifactCheck >= 0 ? workflow.slice(artifactCheck, mcpPublish) : "",
    /dist\/native-host\.js/,
  );
  assert.doesNotMatch(workflow, /npm-v|inputs\.packages|packages=mcp/);
});

process.on("exit", () => {
  for (const dir of tmpRepos) rmSync(dir, { recursive: true, force: true });
});
