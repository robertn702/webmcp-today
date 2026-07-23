import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CafeClient } from "./client.js";
import { jsonResult } from "./result.js";

export function registerReadTools(server: McpServer, client: CafeClient): void {
  server.registerTool(
    "lookup_config",
    {
      description:
        "Look up WebMCP tool configs for a page URL. Returns matching configs, most specific urlPattern first. Verified tools only unless yolo is true.",
      inputSchema: {
        url: z.string().describe("Full page URL, e.g. https://news.ycombinator.com/item?id=1"),
        yolo: z.boolean().optional().describe("Include unverified configs/tools"),
      },
    },
    async ({ url, yolo }) => jsonResult(await client.lookup(url, yolo ?? false)),
  );

  server.registerTool(
    "list_configs",
    {
      description: "Browse registry configs with pagination and optional domain filter.",
      inputSchema: {
        domain: z.string().optional().describe("Filter by domain, e.g. github.com"),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
        yolo: z.boolean().optional().describe("Include unverified configs/tools"),
      },
    },
    async (args) => jsonResult(await client.list(args)),
  );

  server.registerTool(
    "get_stats",
    {
      description: "Registry stats: total configs, total tools, top domains.",
      inputSchema: {},
    },
    async () => jsonResult(await client.stats()),
  );
}
