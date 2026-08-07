import { describe, expect, it, vi } from "vitest";
import { LOCAL_BRIDGE_PROTOCOL_VERSION } from "@webmcp-today/schema";
import { createLocalBridgeRouter } from "../src/lib/local-bridge-router.js";

const document = {
  generation: "document",
  toolsGeneration: "tools",
  title: "Example",
  url: "https://example.com",
};

function createRouter({
  selectedTabId = 9,
  eligibleTabIds = [],
  focusResult = "focused",
  sendToContent = vi.fn(async (_tabId, message: unknown) => {
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
  }),
}: {
  selectedTabId?: number | null;
  eligibleTabIds?: number[];
  focusResult?: "focused" | "not-found" | "not-eligible";
  sendToContent?: ReturnType<typeof vi.fn>;
} = {}) {
  const listEligibleTabIds = vi.fn(async () => eligibleTabIds);
  const focusTab = vi.fn(async () => focusResult);
  return {
    router: createLocalBridgeRouter({
      getSelectedTabId: async () => selectedTabId ?? undefined,
      listEligibleTabIds,
      focusTab,
      sendToContent,
    }),
    sendToContent,
    listEligibleTabIds,
    focusTab,
  };
}

describe("local bridge router", () => {
  it("lists the selected tab first, dedupes ids, and drops failed probes", async () => {
    const sendToContent = vi.fn(async (tabId: number) => {
      if (tabId === 11) throw new Error("Tab closed");
      return {
        ok: true,
        document: { ...document, title: `Tab ${tabId}` },
        tools: [{ name: "search", description: "Search", origin: "https://example.com" }],
      };
    });
    const { router } = createRouter({ eligibleTabIds: [10, 9, 11, 10], sendToContent });

    await expect(
      router.handle({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "list-tabs", requestId: "request" }),
    ).resolves.toMatchObject({
      type: "tabs",
      tabs: [
        { tabId: 9, toolCount: 1 },
        { tabId: 10, toolCount: 1 },
      ],
    });
    expect(sendToContent).toHaveBeenCalledTimes(3);
  });

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
          "The requested tab is not the user's active visible tab. Call focus_webmcp_tab with the target tabId from list_connected_webmcp_tabs, or ask the user to focus the tab in their browser, then retry.",
      },
    });
    expect(sendToContent).not.toHaveBeenCalled();
  });

  it("explains how to recover when no active visible tab is available", async () => {
    const { router } = createRouter({ selectedTabId: null });
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
          "No active visible browser tab is available. Use list_connected_webmcp_tabs to find an eligible tab and focus_webmcp_tab to select it, or ask the user to open the target site in their browser.",
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

  it("focuses an eligible tab without requiring it to be selected", async () => {
    const { router, focusTab, sendToContent } = createRouter({ selectedTabId: 9 });

    await expect(
      router.handle({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "focus-tab",
        requestId: "request",
        tabId: 10,
      }),
    ).resolves.toMatchObject({ type: "tab-focused", tabId: 10 });
    expect(focusTab).toHaveBeenCalledWith(10);
    expect(sendToContent).not.toHaveBeenCalled();
  });

  it("reports an unavailable tab when focus cannot find it", async () => {
    const { router } = createRouter({ focusResult: "not-found" });

    await expect(
      router.handle({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "focus-tab",
        requestId: "request",
        tabId: 10,
      }),
    ).resolves.toMatchObject({ type: "error", error: { code: "tab-unavailable" } });
  });

  it("refuses to focus a tab that does not match an installed package", async () => {
    const { router } = createRouter({ focusResult: "not-eligible" });

    await expect(
      router.handle({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "focus-tab",
        requestId: "request",
        tabId: 10,
      }),
    ).resolves.toMatchObject({ type: "error", error: { code: "tab-not-eligible" } });
  });
});
