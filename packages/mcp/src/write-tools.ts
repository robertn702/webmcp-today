import {
  createConfigSchema,
  publishVersionSchema,
  updateDefinitionMetaSchema,
} from "@robertn702/webmcp-cafe-schema";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CafeClient } from "./client.js";
import { jsonResult } from "./result.js";

// Write tools require WEBMCP_CAFE_API_KEY (created at webmcp.cafe/settings).

export function registerWriteTools(server: McpServer, client: CafeClient): void {
  server.registerTool(
    "upload_config",
    {
      description:
        "Publish a new WebMCP config to the registry as a fresh definition + version 1 (validated against @robertn702/webmcp-cafe-schema). Requires an API key.",
      inputSchema: { config: createConfigSchema.describe("The config to publish") },
    },
    async ({ config }) => jsonResult(await client.create(config)),
  );

  server.registerTool(
    "update_config_meta",
    {
      description:
        "Update a config's metadata (domain, title, description, tags, minEngine, pageType) — owner only. Never touches urlPatterns/tools; use publish_config_version for that. Requires an API key.",
      inputSchema: {
        id: z.string().describe("Config (definition) id"),
        meta: updateDefinitionMetaSchema.describe("Metadata fields to change"),
      },
    },
    async ({ id, meta }) => jsonResult(await client.updateMeta(id, meta)),
  );

  server.registerTool(
    "publish_config_version",
    {
      description:
        "Publish the next version of a config you contributed (urlPatterns + tools + optional changelog) — owner only, append-only. Installed users stay pinned until they update. Requires an API key.",
      inputSchema: {
        id: z.string().describe("Config (definition) id"),
        version: publishVersionSchema.describe("The new version's urlPatterns, tools, changelog"),
      },
    },
    async ({ id, version }) => jsonResult(await client.publishVersion(id, version)),
  );

  server.registerTool(
    "install_config",
    {
      description:
        "Install a config, pinned to its latest version (or a specific versionId). Requires an API key.",
      inputSchema: {
        id: z.string().describe("Config (definition) id"),
        versionId: z.string().optional().describe("Pin to this version instead of latest"),
      },
    },
    async ({ id, versionId }) => jsonResult(await client.install(id, versionId)),
  );

  server.registerTool(
    "uninstall_config",
    {
      description: "Uninstall a previously installed config. Requires an API key.",
      inputSchema: { id: z.string().describe("Config (definition) id") },
    },
    async ({ id }) => jsonResult(await client.uninstall(id)),
  );

  server.registerTool(
    "update_config_install",
    {
      description:
        "Move an installed config's pin to a different version (defaults to latest; pass an older versionId to roll back). Requires an API key.",
      inputSchema: {
        id: z.string().describe("Config (definition) id"),
        versionId: z.string().optional().describe("Move to this version instead of latest"),
      },
    },
    async ({ id, versionId }) => jsonResult(await client.updateInstall(id, versionId)),
  );
}
