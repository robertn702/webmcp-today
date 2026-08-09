import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MCP_BRIDGE_PACKAGE } from "@/app/(registry)/docs/content";

// MCP_BRIDGE_PACKAGE pins the bridge version shown in every quickstart client
// config. A release that bumps packages/mcp/package.json without updating
// that constant would silently ship stale install instructions — this guards
// the two stay in sync, without importing the workspace package itself (the
// web app depends on @webmcp-today/schema, not @webmcp-today/mcp-bridge).
const testDirectory = dirname(fileURLToPath(import.meta.url));
const mcpPackageJsonPath = resolve(testDirectory, "../../../packages/mcp/package.json");

describe("MCP_BRIDGE_PACKAGE", () => {
  it("matches the published bridge's name and version", async () => {
    const mcpPackageJson: { name: string; version: string } = JSON.parse(
      await readFile(mcpPackageJsonPath, "utf8"),
    );
    expect(MCP_BRIDGE_PACKAGE).toBe(`${mcpPackageJson.name}@${mcpPackageJson.version}`);
  });
});
