/* global process */

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const skillDirectory = dirname(scriptsDirectory);
const validatorPath = join(scriptsDirectory, "validate.mjs");
const assetPath = join(skillDirectory, "assets", "minimal-readonly-package.json");

function validate(path) {
  return spawnSync(process.execPath, [validatorPath, path], {
    cwd: skillDirectory,
    encoding: "utf8",
  });
}

async function readAsset() {
  return JSON.parse(await readFile(assetPath, "utf8"));
}

test("valid bundled asset passes", () => {
  const result = validate(assetPath);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid WebMCP Today package/);
  assert.match(result.stdout, /jsonplaceholder_posts/);
});

test("validator runs from an unrelated workspace", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "webmcp-workspace-"));
  const packagePath = join(workspace, "webmcp-package.json");
  await writeFile(packagePath, await readFile(assetPath, "utf8"));

  const result = spawnSync(process.execPath, [validatorPath, packagePath], {
    cwd: workspace,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid WebMCP Today package/);
});

test("unknown placeholder fails with an actionable path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "webmcp-skill-"));
  const packagePath = join(directory, "unknown-placeholder.json");
  const pkg = await readAsset();
  pkg.api.endpoints.posts.query.userId = "{{accountId}}";
  await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

  const result = validate(packagePath);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\$\.api\.endpoints\.posts\.query\.userId/);
  assert.match(result.stderr, /\{\{accountId\}\}.*no matching inputSchema property/);
  assert.match(result.stderr, /Available: userId, limit/);
});

test("cross-domain baseUrl fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "webmcp-skill-"));
  const packagePath = join(directory, "cross-domain.json");
  const pkg = await readAsset();
  pkg.api.baseUrl = "https://api.example.net";
  await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

  const result = validate(packagePath);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\$\.api\.baseUrl/);
  assert.match(result.stderr, /must be "jsonplaceholder\.typicode\.com" or one of its subdomains/);
});
