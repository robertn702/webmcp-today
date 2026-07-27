import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CafeClient } from "./client.js";
import { jsonResult } from "./result.js";

export function registerReadTools(server: McpServer, client: CafeClient): void {
  server.registerTool(
    "lookup_package",
    {
      description:
        "Look up WebMCP tool packages for a page URL, at each package's latest version. Returns matches most-specific-pattern first.",
      inputSchema: {
        url: z.string().describe("Full page URL, e.g. https://news.ycombinator.com/item?id=1"),
      },
    },
    async ({ url }) => jsonResult(await client.lookup(url)),
  );

  server.registerTool(
    "list_packages",
    {
      description:
        "Browse registry packages with pagination and optional domain filter (each at its latest version).",
      inputSchema: {
        domain: z.string().optional().describe("Filter by domain, e.g. github.com"),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args) => jsonResult(await client.list(args)),
  );

  server.registerTool(
    "get_package",
    {
      description: "Get a single package by id, at its latest version.",
      inputSchema: { id: z.string().describe("Package id") },
    },
    async ({ id }) => jsonResult(await client.get(id)),
  );

  server.registerTool(
    "list_installs",
    {
      description:
        "List the caller's installed packages, each pinned to its installed version. Requires an API key.",
      inputSchema: {},
    },
    async () => jsonResult(await client.installs()),
  );

  server.registerTool(
    "get_stats",
    {
      description: "Registry stats: total packages, total installs, top domains.",
      inputSchema: {},
    },
    async () => jsonResult(await client.stats()),
  );
}
