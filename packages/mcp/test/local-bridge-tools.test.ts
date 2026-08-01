import { describe, expect, it, vi } from "vitest";
import { LOCAL_BRIDGE_PROTOCOL_VERSION } from "@robertn702/webmcp-today-schema";
import {
  createLocalBridgeToolHandlers,
  executeWebmcpToolDescription,
} from "../src/local-bridge-tools.js";

describe("local bridge MCP tool handlers", () => {
  it("turns an execution tool call into a versioned local bridge request", async () => {
    const request = vi.fn(async () => ({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "tool-result" as const,
      requestId: "request",
      tabId: 4,
      document: {
        generation: "document",
        toolsGeneration: "tools",
        title: "Example",
        url: "https://example.com",
      },
      result: { content: [{ type: "text", text: "ok" }] },
    }));
    const handlers = createLocalBridgeToolHandlers({ request });

    const result = await handlers.executeTool({
      tabId: 4,
      documentGeneration: "document",
      toolsGeneration: "tools",
      toolName: "search",
      toolOrigin: "https://example.com",
      input: { query: "coffee" },
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "execute-tool",
        tabId: 4,
        inputJson: '{"query":"coffee"}',
      }),
    );
    expect(result).toMatchObject({ content: [{ text: expect.stringContaining("tool-result") }] });
  });

  it("passes an empty object to a no-argument WebMCP tool", async () => {
    const request = vi.fn(async () => ({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "tool-result" as const,
      requestId: "request",
      tabId: 4,
      document: {
        generation: "document",
        toolsGeneration: "tools",
        title: "Example",
        url: "https://example.com",
      },
      result: null,
    }));
    const handlers = createLocalBridgeToolHandlers({ request });

    await handlers.executeTool({
      tabId: 4,
      documentGeneration: "document",
      toolsGeneration: "tools",
      toolName: "ping",
      toolOrigin: "https://example.com",
      input: {},
    });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({ inputJson: "{}" }));
  });

  it("marks structured bridge failures as MCP tool errors", async () => {
    const handlers = createLocalBridgeToolHandlers({
      request: async () => ({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "error",
        requestId: "request",
        error: { code: "stale-tool", message: "List tools again." },
      }),
    });

    await expect(handlers.listTools(4)).resolves.toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining("stale-tool") }],
    });
  });

  it("marks protocol mismatches as MCP tool errors", async () => {
    const handlers = createLocalBridgeToolHandlers({
      request: async () => ({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "error",
        requestId: "request",
        error: { code: "protocol-mismatch", message: "Update the bridge components." },
      }),
    });

    await expect(handlers.listTabs()).resolves.toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining("protocol-mismatch") }],
    });
  });

  it("limits confirmation claims to registry-injected package tools", () => {
    expect(executeWebmcpToolDescription).toContain("Registry-injected package tools");
    expect(executeWebmcpToolDescription).not.toContain("Destructive tools still require");
  });

  it("explains the retry-safe dispatch failure separately from unknown execution outcomes", () => {
    expect(executeWebmcpToolDescription).toContain("execution-timeout");
    expect(executeWebmcpToolDescription).toContain("dispatch-failed");
    expect(executeWebmcpToolDescription).toContain("did not run and can be retried");
  });
});
