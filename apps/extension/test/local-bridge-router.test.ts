import { describe, expect, it, vi } from "vitest";
import { LOCAL_BRIDGE_PROTOCOL_VERSION } from "@robertn702/webmcp-today-schema";
import { createLocalBridgeRouter } from "../src/lib/local-bridge-router.js";

const document = {
  generation: "document",
  toolsGeneration: "tools",
  title: "Example",
  url: "https://example.com",
};

function createRouter(selectedTabId = 9) {
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
    router: createLocalBridgeRouter({ getSelectedTabId: async () => selectedTabId, sendToContent }),
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
    ).resolves.toMatchObject({ type: "error", error: { code: "tab-not-eligible" } });
    expect(sendToContent).not.toHaveBeenCalled();
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
