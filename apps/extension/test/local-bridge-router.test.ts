import { describe, expect, it, vi } from "vitest";
import { LOCAL_BRIDGE_PROTOCOL_VERSION } from "@webmcp-today/schema";
import { createLocalBridgeRouter } from "../src/lib/local-bridge-router.js";

const document = {
  generation: "document",
  toolsGeneration: "tools",
  title: "Example",
  url: "https://example.com",
};

function createRouter(selectedTabId: number | null = 9) {
  const sendToContent = vi.fn(async (_tabId, message: unknown) => {
    if (typeof message === "object" && message !== null) {
      if (Reflect.get(message, "type") === "webmcp-today:local-bridge:execute-tool") {
        return { ok: true, document, result: { content: [{ type: "text", text: "ok" }] } };
      }
    }
    return {
      ok: true,
      document,
      tools: [
        {
          name: "search",
          description: "Search",
          inputSchema: "{}",
          origin: "https://example.com",
        },
      ],
    };
  });
  return {
    router: createLocalBridgeRouter({
      getSelectedTabId: async () => selectedTabId ?? undefined,
      sendToContent,
    }),
    sendToContent,
  };
}

describe("local bridge router", () => {
  it("lists only the selected eligible tab", async () => {
    const { router } = createRouter();
    await expect(
      router.handle({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "list-tabs", requestId: "request" }),
    ).resolves.toMatchObject({ type: "tabs", tabs: [{ tabId: 9, toolCount: 1 }] });
  });

  it("refuses a request for a tab the user did not select", async () => {
    const { router, sendToContent } = createRouter();
    await expect(
      router.handle({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "list-tools",
        requestId: "request",
        tabId: 10,
      }),
    ).resolves.toMatchObject({
      type: "error",
      error: {
        code: "tab-not-eligible",
        message:
          "The requested tab is not the user's active visible tab. Ask the user to focus the target tab in their browser or navigate to the page in their active tab.",
      },
    });
    expect(sendToContent).not.toHaveBeenCalled();
  });

  it("explains how to recover when no active visible tab is available", async () => {
    const { router } = createRouter(null);
    await expect(
      router.handle({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "list-tools",
        requestId: "request",
        tabId: 9,
      }),
    ).resolves.toMatchObject({
      type: "error",
      error: {
        code: "tab-unavailable",
        message:
          "No active visible browser tab is available. Ask the user to open or focus the target site in their browser.",
      },
    });
  });

  it("routes execution through the content script with the supplied generations", async () => {
    const { router, sendToContent } = createRouter();
    await expect(
      router.handle({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "execute-tool",
        requestId: "request",
        tabId: 9,
        documentGeneration: "document",
        toolsGeneration: "tools",
        toolName: "search",
        toolOrigin: "https://example.com",
        inputJson: "{}",
      }),
    ).resolves.toMatchObject({ type: "tool-result", result: { content: [{ text: "ok" }] } });
    expect(sendToContent).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ type: "webmcp-today:local-bridge:execute-tool" }),
    );
  });
});
