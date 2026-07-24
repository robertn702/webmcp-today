import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CafeClient } from "./client.js";
import { jsonResult } from "./result.js";

export function registerReadTools(server: McpServer, client: CafeClient): void {
  server.registerTool(
    "lookup_config",
    {
      description:
        "Look up WebMCP tool configs for a page URL, at each definition's latest version. Returns matches most-specific-pattern first. Pass installed=true (requires an API key) to get the caller's installed configs pinned to their installed version instead.",
      inputSchema: {
        url: z.string().describe("Full page URL, e.g. https://news.ycombinator.com/item?id=1"),
        installed: z.boolean().optional().describe("Return the caller's installed configs"),
      },
    },
    async ({ url, installed }) => jsonResult(await client.lookup(url, installed ?? false)),
  );

  server.registerTool(
    "list_configs",
    {
      description:
        "Browse registry configs with pagination and optional domain filter (each at its latest version).",
      inputSchema: {
        domain: z.string().optional().describe("Filter by domain, e.g. github.com"),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args) => jsonResult(await client.list(args)),
  );

  server.registerTool(
    "get_config",
    {
      description: "Get a single config by id, at its latest version.",
      inputSchema: { id: z.string().describe("Config (definition) id") },
    },
    async ({ id }) => jsonResult(await client.get(id)),
  );

  server.registerTool(
    "get_stats",
    {
      description: "Registry stats: total configs, total installs, top domains.",
      inputSchema: {},
    },
    async () => jsonResult(await client.stats()),
  );
}
