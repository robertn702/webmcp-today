import { describe, expect, it, vi } from "vitest";
import { LOCAL_BRIDGE_PROTOCOL_VERSION } from "@robertn702/webmcp-today-schema";
import { LocalBridgeContent } from "../src/lib/local-bridge-content.js";

const tool = {
  name: "search",
  description: "Search the example site",
  inputSchema: '{"type":"object"}',
  origin: "https://example.com",
  window: globalThis,
};

const noInputTool = {
  name: "ping",
  description: "Check whether the example site is available",
  origin: "https://example.com",
  window: globalThis,
};

function harness(options?: {
  getTools?: () => Promise<unknown[]>;
  executeTool?: (liveTool: unknown, inputJson: string) => Promise<unknown>;
  getUrl?: () => string;
}) {
  const listeners = new Map<string, EventListener>();
  const getTools = vi.fn(options?.getTools ?? (async () => [tool]));
  const executeTool = vi.fn(
    options?.executeTool ?? (async () => ({ content: [{ type: "text", text: "ok" }] })),
  );
  const bridge = new LocalBridgeContent({
    getConsumer: () => ({
      getTools,
      executeTool,
      addEventListener: (type, listener) => listeners.set(type, listener),
    }),
    getTitle: () => "Example",
    getUrl: options?.getUrl ?? (() => "https://example.com/path"),
  });
  return { bridge, executeTool, getTools, listeners };
}

function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((reason?: unknown) => void) | undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {
    promise,
    resolve(value: T) {
      if (!resolve) throw new Error("Deferred promise was not initialized.");
      resolve(value);
    },
    reject(reason: unknown) {
      if (!reject) throw new Error("Deferred promise was not initialized.");
      reject(reason);
    },
  };
}

describe("LocalBridgeContent", () => {
  it("lists descriptors without serializing live tool handles", async () => {
    const { bridge } = harness();

    const response = await bridge.handleMessage({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "webmcp-today:local-bridge:list-tools",
    });

    expect(response).toMatchObject({ ok: true, tools: [{ name: "search", origin: tool.origin }] });
    if (response.ok && "tools" in response) expect(response.tools[0]).not.toHaveProperty("window");
  });

  it("looks up a fresh tool before invoking it", async () => {
    const { bridge, executeTool, getTools } = harness();
    const listed = await bridge.handleMessage({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "webmcp-today:local-bridge:list-tools",
    });
    if (!listed.ok || !("tools" in listed)) throw new Error("Expected tools");

    const response = await bridge.handleMessage({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "webmcp-today:local-bridge:execute-tool",
      documentGeneration: listed.document.generation,
      toolsGeneration: listed.document.toolsGeneration,
      toolName: "search",
      toolOrigin: tool.origin,
      inputJson: '{"query":"coffee"}',
    });

    expect(response).toMatchObject({ ok: true, result: { content: [{ text: "ok" }] } });
    expect(getTools).toHaveBeenCalledTimes(2);
    expect(executeTool).toHaveBeenCalledWith(tool, '{"query":"coffee"}');
  });

  it("lists and executes a WebMCP tool without an input schema", async () => {
    const { bridge, executeTool } = harness({
      getTools: async () => [noInputTool],
    });
    const listed = await bridge.handleMessage({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "webmcp-today:local-bridge:list-tools",
    });
    if (!listed.ok || !("tools" in listed)) throw new Error("Expected tools");

    expect(listed.tools).toEqual([
      {
        name: "ping",
        description: noInputTool.description,
        origin: noInputTool.origin,
      },
    ]);

    const response = await bridge.handleMessage({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "webmcp-today:local-bridge:execute-tool",
      documentGeneration: listed.document.generation,
      toolsGeneration: listed.document.toolsGeneration,
      toolName: "ping",
      toolOrigin: noInputTool.origin,
      inputJson: "{}",
    });

    expect(response).toMatchObject({ ok: true, result: { content: [{ text: "ok" }] } });
    expect(executeTool).toHaveBeenCalledWith(noInputTool, "{}");
  });

  it("normalizes an undefined WebMCP result to null", async () => {
    const { bridge } = harness({ executeTool: async () => undefined });
    const listed = await bridge.handleMessage({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "webmcp-today:local-bridge:list-tools",
    });
    if (!listed.ok || !("tools" in listed)) throw new Error("Expected tools");

    await expect(
      bridge.handleMessage({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "webmcp-today:local-bridge:execute-tool",
        documentGeneration: listed.document.generation,
        toolsGeneration: listed.document.toolsGeneration,
        toolName: "search",
        toolOrigin: tool.origin,
        inputJson: "{}",
      }),
    ).resolves.toMatchObject({ ok: true, result: null });
  });

  it.each(["toolchange", "navigation"] as const)(
    "returns stale-tool when %s invalidates a pending list discovery",
    async (invalidation) => {
      const pendingTools = deferred<unknown[]>();
      let url = "https://example.com/path";
      const { bridge, getTools, listeners } = harness({
        getTools: () => pendingTools.promise,
        getUrl: () => url,
      });
      bridge.installToolChangeListener();

      const listing = bridge.handleMessage({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "webmcp-today:local-bridge:list-tools",
      });
      expect(getTools).toHaveBeenCalledOnce();
      if (invalidation === "toolchange") listeners.get("toolchange")?.(new Event("toolchange"));
      else url = "https://example.com/next";
      pendingTools.resolve([tool]);

      await expect(listing).resolves.toMatchObject({ ok: false, error: { code: "stale-tool" } });
    },
  );

  it.each(["toolchange", "navigation"] as const)(
    "returns stale-tool when %s invalidates a rejected list discovery",
    async (invalidation) => {
      const pendingTools = deferred<unknown[]>();
      let url = "https://example.com/path";
      const { bridge, getTools, listeners } = harness({
        getTools: () => pendingTools.promise,
        getUrl: () => url,
      });
      bridge.installToolChangeListener();

      const listing = bridge.handleMessage({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "webmcp-today:local-bridge:list-tools",
      });
      expect(getTools).toHaveBeenCalledOnce();
      if (invalidation === "toolchange") listeners.get("toolchange")?.(new Event("toolchange"));
      else url = "https://example.com/next";
      pendingTools.reject(new Error("discovery failed"));

      await expect(listing).resolves.toMatchObject({ ok: false, error: { code: "stale-tool" } });
    },
  );

  it.each(["toolchange", "navigation"] as const)(
    "returns stale-tool without execution when %s invalidates a pending execution discovery",
    async (invalidation) => {
      const pendingTools = deferred<unknown[]>();
      let url = "https://example.com/path";
      const getTools = vi
        .fn<() => Promise<unknown[]>>()
        .mockResolvedValueOnce([tool])
        .mockImplementationOnce(() => pendingTools.promise);
      const { bridge, executeTool, listeners } = harness({ getTools, getUrl: () => url });
      bridge.installToolChangeListener();
      const listed = await bridge.handleMessage({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "webmcp-today:local-bridge:list-tools",
      });
      if (!listed.ok || !("tools" in listed)) throw new Error("Expected tools");

      const execution = bridge.handleMessage({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "webmcp-today:local-bridge:execute-tool",
        documentGeneration: listed.document.generation,
        toolsGeneration: listed.document.toolsGeneration,
        toolName: "search",
        toolOrigin: tool.origin,
        inputJson: "{}",
      });
      expect(getTools).toHaveBeenCalledTimes(2);
      if (invalidation === "toolchange") listeners.get("toolchange")?.(new Event("toolchange"));
      else url = "https://example.com/next";
      pendingTools.resolve([tool]);

      await expect(execution).resolves.toMatchObject({ ok: false, error: { code: "stale-tool" } });
      expect(executeTool).not.toHaveBeenCalled();
    },
  );

  it.each(["toolchange", "navigation"] as const)(
    "returns stale-tool without execution when %s invalidates a rejected execution discovery",
    async (invalidation) => {
      const pendingTools = deferred<unknown[]>();
      let url = "https://example.com/path";
      const getTools = vi
        .fn<() => Promise<unknown[]>>()
        .mockResolvedValueOnce([tool])
        .mockImplementationOnce(() => pendingTools.promise);
      const { bridge, executeTool, listeners } = harness({ getTools, getUrl: () => url });
      bridge.installToolChangeListener();
      const listed = await bridge.handleMessage({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "webmcp-today:local-bridge:list-tools",
      });
      if (!listed.ok || !("tools" in listed)) throw new Error("Expected tools");

      const execution = bridge.handleMessage({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "webmcp-today:local-bridge:execute-tool",
        documentGeneration: listed.document.generation,
        toolsGeneration: listed.document.toolsGeneration,
        toolName: "search",
        toolOrigin: tool.origin,
        inputJson: "{}",
      });
      if (invalidation === "toolchange") listeners.get("toolchange")?.(new Event("toolchange"));
      else url = "https://example.com/next";
      pendingTools.reject(new Error("discovery failed"));

      await expect(execution).resolves.toMatchObject({ ok: false, error: { code: "stale-tool" } });
      expect(executeTool).not.toHaveBeenCalled();
    },
  );

  it("refuses a stale tool after navigation or toolchange", async () => {
    const { bridge, listeners, executeTool } = harness();
    bridge.installToolChangeListener();
    const listed = await bridge.handleMessage({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "webmcp-today:local-bridge:list-tools",
    });
    if (!listed.ok || !("tools" in listed)) throw new Error("Expected tools");
    bridge.invalidateDocument();

    const staleAfterNavigation = await bridge.handleMessage({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "webmcp-today:local-bridge:execute-tool",
      documentGeneration: listed.document.generation,
      toolsGeneration: listed.document.toolsGeneration,
      toolName: "search",
      toolOrigin: tool.origin,
      inputJson: "{}",
    });
    expect(staleAfterNavigation).toMatchObject({ ok: false, error: { code: "stale-tool" } });

    const listedAgain = await bridge.handleMessage({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "webmcp-today:local-bridge:list-tools",
    });
    if (!listedAgain.ok || !("tools" in listedAgain)) throw new Error("Expected tools");
    listeners.get("toolchange")?.(new Event("toolchange"));
    const staleAfterToolChange = await bridge.handleMessage({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "webmcp-today:local-bridge:execute-tool",
      documentGeneration: listedAgain.document.generation,
      toolsGeneration: listedAgain.document.toolsGeneration,
      toolName: "search",
      toolOrigin: tool.origin,
      inputJson: "{}",
    });
    expect(staleAfterToolChange).toMatchObject({ ok: false, error: { code: "stale-tool" } });
    expect(executeTool).not.toHaveBeenCalled();
  });
});
