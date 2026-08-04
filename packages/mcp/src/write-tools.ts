import {
  createPackageSchema,
  publishVersionSchema,
  updatePackageMetaSchema,
} from "@webmcp-today/schema";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RegistryClient } from "./client.js";
import { jsonResult } from "./result.js";

// Write tools require WEBMCP_TODAY_API_KEY (created at webmcp.today/settings).

const installResultSchema = z.object({
  ok: z.literal(true),
  versionId: z.string(),
  version: z.number(),
});

export function registerWriteTools(server: McpServer, client: RegistryClient): void {
  server.registerTool(
    "publish_package",
    {
      description:
        "Publish a new WebMCP package to the registry as a fresh package whose version field must declare 1 (validated against @webmcp-today/schema). Requires an API key.",
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
        "Publish the next version of a package you contributed (urlPatterns + tools + optional api, minEngine, changelog) — owner only, append-only. The version field is author-declared and must equal the current latest version + 1 exactly (query the package first to see it); a 409 response returns the expectedVersion to declare on retry. Installed users stay pinned until they move their install pin. Requires an API key.",
      inputSchema: {
        id: z.string().describe("Package id"),
        version: publishVersionSchema.describe(
          "The new version's declared version number (latest + 1), urlPatterns, tools, changelog",
        ),
      },
    },
    async ({ id, version }) => jsonResult(await client.publishVersion(id, version)),
  );

  server.registerTool(
    "install_package",
    {
      description:
        "Pin a package to its latest version, or a given versionId, on your webmcp.today account — creates the pin if absent, moves it if present (also how rollback works: pass an older versionId). This does not install into your browser; the extension's installs are local to the browser. Returns a link that installs this exact version there. Requires an API key.",
      inputSchema: {
        id: z.string().describe("Package id"),
        versionId: z.string().optional().describe("Pin to this version instead of latest"),
      },
    },
    async ({ id, versionId }) => {
      const result = installResultSchema.parse(await client.install(id, versionId));
      return jsonResult({
        ...result,
        installUrl: `${client.baseUrl}/packages/${id}?install=${result.versionId}`,
      });
    },
  );

  server.registerTool(
    "uninstall_package",
    {
      description:
        "Remove the caller's install pin on your webmcp.today account. This does not affect the extension's local install in your browser. Requires an API key.",
      inputSchema: { id: z.string().describe("Package id") },
    },
    async ({ id }) => jsonResult(await client.uninstall(id)),
  );
}
