import {
  createPackageSchema,
  publishVersionSchema,
  updatePackageMetaSchema,
} from "@robertn702/webmcp-cafe-schema";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CafeClient } from "./client.js";
import { jsonResult } from "./result.js";

// Write tools require WEBMCP_CAFE_API_KEY (created at webmcp.cafe/settings).

export function registerWriteTools(server: McpServer, client: CafeClient): void {
  server.registerTool(
    "publish_package",
    {
      description:
        "Publish a new WebMCP package to the registry as a fresh package + version 1 (validated against @robertn702/webmcp-cafe-schema). Requires an API key.",
      inputSchema: { package: createPackageSchema.describe("The package to publish") },
    },
    async ({ package: pkg }) => jsonResult(await client.create(pkg)),
  );

  server.registerTool(
    "update_package_meta",
    {
      description:
        "Update a package's metadata (domain, title, description, pageType) — owner only. Never touches urlPatterns/tools/minEngine; use publish_package_version for that. Requires an API key.",
      inputSchema: {
        id: z.string().describe("Package id"),
        meta: updatePackageMetaSchema.describe("Metadata fields to change"),
      },
    },
    async ({ id, meta }) => jsonResult(await client.updateMeta(id, meta)),
  );

  server.registerTool(
    "publish_package_version",
    {
      description:
        "Publish the next version of a package you contributed (urlPatterns + tools + optional api, minEngine, changelog) — owner only, append-only. Installed users stay pinned until they move their install pin. Requires an API key.",
      inputSchema: {
        id: z.string().describe("Package id"),
        version: publishVersionSchema.describe("The new version's urlPatterns, tools, changelog"),
      },
    },
    async ({ id, version }) => jsonResult(await client.publishVersion(id, version)),
  );

  server.registerTool(
    "install_package",
    {
      description:
        "Set the caller's install pin for a package to its latest version, or a given versionId — creates the pin if absent, moves it if present. Also how rollback works: pass an older versionId. Requires an API key.",
      inputSchema: {
        id: z.string().describe("Package id"),
        versionId: z.string().optional().describe("Pin to this version instead of latest"),
      },
    },
    async ({ id, versionId }) => jsonResult(await client.install(id, versionId)),
  );

  server.registerTool(
    "uninstall_package",
    {
      description: "Uninstall a previously installed package. Requires an API key.",
      inputSchema: { id: z.string().describe("Package id") },
    },
    async ({ id }) => jsonResult(await client.uninstall(id)),
  );
}
