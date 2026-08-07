import {
  LOCAL_BRIDGE_PROTOCOL_VERSION,
  localBridgeRequestSchema,
  type LocalBridgeRequest,
  type LocalBridgeResponse,
} from "@webmcp-today/schema";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { LocalBridgeClient } from "./local-bridge-client.js";
import { jsonResult } from "./result.js";

interface LocalBridgeClientLike {
  request(request: LocalBridgeRequest): Promise<LocalBridgeResponse>;
}

export const executeWebmcpToolDescription =
  "Execute one live WebMCP tool in the user-selected active visible Chrome/Brave tab. Use the tab and generation values from list_webmcp_tools. If execution fails because the tab is not eligible or available, call focus_webmcp_tab with the target tabId, then retry. Registry-injected package tools retain their existing confirmation behavior. An execution-timeout error means the call may still have run - verify its effect before retrying. A dispatch-failed error confirms that the call did not run and can be retried.";

export function createLocalBridgeToolHandlers(client: LocalBridgeClientLike) {
  return {
    listTabs: async () => bridgeResult(await client.request(request("list-tabs", {}))),
    focusTab: async (tabId: number) =>
      bridgeResult(await client.request(request("focus-tab", { tabId }))),
    listTools: async (tabId: number) =>
      bridgeResult(await client.request(request("list-tools", { tabId }))),
    executeTool: async (args: {
      tabId: number;
      documentGeneration: string;
      toolsGeneration: string;
      toolName: string;
      toolOrigin: string;
      input: Record<string, unknown>;
    }) =>
      bridgeResult(
        await client.request(
          request("execute-tool", {
            tabId: args.tabId,
            documentGeneration: args.documentGeneration,
            toolsGeneration: args.toolsGeneration,
            toolName: args.toolName,
            toolOrigin: args.toolOrigin,
            inputJson: JSON.stringify(args.input),
          }),
        ),
      ),
  };
}

export function registerLocalBridgeTools(server: McpServer, client: LocalBridgeClient): void {
  const handlers = createLocalBridgeToolHandlers(client);
  server.registerTool(
    "list_connected_webmcp_tabs",
    {
      description:
        "List all Chrome/Brave tabs with reachable WebMCP tools: the user's selected tab plus tabs matching installed packages. Use focus_webmcp_tab with a tabId from this list to switch targets.",
      inputSchema: {},
    },
    handlers.listTabs,
  );

  server.registerTool(
    "focus_webmcp_tab",
    {
      description:
        "Focus a connected tab, making it the selected target for list_webmcp_tools and execute_webmcp_tool. Use a tabId from list_connected_webmcp_tabs.",
      inputSchema: {
        tabId: z.number().int().nonnegative().describe("Tab id from list_connected_webmcp_tabs"),
      },
    },
    async ({ tabId }) => handlers.focusTab(tabId),
  );

  server.registerTool(
    "list_webmcp_tools",
    {
      description:
        "List live WebMCP tools in the user-selected active visible Chrome/Brave tab. Returns a document and tool-list generation required by execute_webmcp_tool. If the tab is not eligible or available, call focus_webmcp_tab with the target tabId, then retry.",
      inputSchema: {
        tabId: z.number().int().nonnegative().describe("Tab id from list_connected_webmcp_tabs"),
      },
    },
    async ({ tabId }) => handlers.listTools(tabId),
  );

  server.registerTool(
    "execute_webmcp_tool",
    {
      description: executeWebmcpToolDescription,
      inputSchema: {
        tabId: z.number().int().nonnegative(),
        documentGeneration: z.string().min(1),
        toolsGeneration: z.string().min(1),
        toolName: z.string().min(1),
        toolOrigin: z.string().url(),
        input: z.record(z.string(), z.unknown()).describe("JSON object passed to the WebMCP tool"),
      },
    },
    handlers.executeTool,
  );
}

function request(
  type: "list-tabs" | "focus-tab" | "list-tools" | "execute-tool",
  fields: Record<string, unknown>,
) {
  return localBridgeRequestSchema.parse({
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type,
    requestId: crypto.randomUUID(),
    ...fields,
  });
}

function bridgeResult(response: LocalBridgeResponse) {
  if (response.type === "error") {
    return {
      ...jsonResult(response.error),
      isError: true,
    };
  }
  return jsonResult(response);
}
