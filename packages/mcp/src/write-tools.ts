import { createConfigSchema, updateConfigSchema } from "@robertn702/webmcp-cafe-schema";
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
        "Upload a new WebMCP config to the registry (validated against @robertn702/webmcp-cafe-schema). Requires an API key.",
      inputSchema: { config: createConfigSchema.describe("The config to upload") },
    },
    async ({ config }) => jsonResult(await client.create(config)),
  );

  server.registerTool(
    "update_config",
    {
      description:
        "Update a config you contributed. Replacing tools bumps the version and resets verification. Requires an API key.",
      inputSchema: {
        id: z.string().describe("Config id"),
        patch: updateConfigSchema.describe("Fields to change"),
      },
    },
    async ({ id, patch }) => jsonResult(await client.update(id, patch)),
  );

  server.registerTool(
    "vote_on_config",
    {
      description:
        "Vote on whether a config works: +1 (works) or -1 (broken). Requires an API key.",
      inputSchema: {
        id: z.string().describe("Config id"),
        value: z
          .union([z.literal(1), z.literal(-1)])
          .describe("+1 if the config works, -1 if broken"),
      },
    },
    async ({ id, value }) => jsonResult(await client.vote(id, value)),
  );
}
