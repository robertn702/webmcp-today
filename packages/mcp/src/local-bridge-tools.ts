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
  "Execute one live WebMCP tool in the user-selected visible Chrome tab. Use the tab and generation values from list_webmcp_tools. Registry-injected package tools retain their existing confirmation behavior. An execution-timeout error means the call may still have run - verify its effect before retrying. A dispatch-failed error confirms that the call did not run and can be retried.";

export function createLocalBridgeToolHandlers(client: LocalBridgeClientLike) {
  return {
    listTabs: async () => bridgeResult(await client.request(request("list-tabs", {}))),
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
        "List the user-selected visible Chrome tab if WebMCP tool discovery is available there. Select a browser tab before calling another bridge tool.",
      inputSchema: {},
    },
    handlers.listTabs,
  );

  server.registerTool(
    "list_webmcp_tools",
    {
      description:
        "List live WebMCP tools in the user-selected visible Chrome tab. Returns a document and tool-list generation required by execute_webmcp_tool.",
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
  type: "list-tabs" | "list-tools" | "execute-tool",
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
