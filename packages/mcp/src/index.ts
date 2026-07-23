#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CafeClient } from "./client.js";
import { registerReadTools } from "./read-tools.js";
import { registerWriteTools } from "./write-tools.js";

const baseUrl = process.env.WEBMCP_CAFE_API_URL ?? "https://webmcp.cafe";
const apiKey = process.env.WEBMCP_CAFE_API_KEY;

const server = new McpServer({ name: "webmcp-cafe", version: "0.1.0" });
const client = new CafeClient({ baseUrl, apiKey });

registerReadTools(server, client);
registerWriteTools(server, client);

await server.connect(new StdioServerTransport());
console.error(`webmcp-cafe MCP server connected (registry: ${baseUrl})`);
