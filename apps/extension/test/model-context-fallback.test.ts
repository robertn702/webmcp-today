import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_BRIDGE_PROTOCOL_VERSION } from "@webmcp-today/schema";
import { LocalBridgeContent } from "../src/lib/local-bridge-content.js";
import { getOrCreateFallbackModelContext } from "../src/lib/model-context-fallback.js";

const origin = "https://example.com";
const controllers: AbortController[] = [];

beforeEach(() => {
  vi.stubGlobal("document", {});
  vi.stubGlobal("location", { origin });
});

afterEach(() => {
  for (const controller of controllers) controller.abort();
  controllers.length = 0;
  vi.unstubAllGlobals();
});

describe("fallback model context", () => {
  it("is a document singleton and exposes bridge-compatible handles", async () => {
    const context = getOrCreateFallbackModelContext();
    expect(getOrCreateFallbackModelContext()).toBe(context);
    const controller = new AbortController();
    controllers.push(controller);

    await context.registerTool(
      {
        name: "fallback_handle",
        description: "Returns its input",
        inputSchema: { type: "object" },
        annotations: { readOnlyHint: true },
        execute: async (params) => ({ content: [{ type: "text", text: String(params.query) }] }),
      },
      { signal: controller.signal },
    );

    const tools = await context.getTools();
    expect(tools).toContainEqual({
      name: "fallback_handle",
      description: "Returns its input",
      inputSchema: '{"type":"object"}',
      origin,
      annotations: { readOnlyHint: true },
    });
  });

  it("rejects duplicate names and unregisters aborted tools with toolchange events", async () => {
    const context = getOrCreateFallbackModelContext();
    const controller = new AbortController();
    controllers.push(controller);
    const changes = vi.fn();
    context.addEventListener?.("toolchange", changes);

    await context.registerTool(
      {
        name: "fallback_abort",
        description: "Removed when its pass ends",
        inputSchema: { type: "object" },
        execute: async () => ({ content: [] }),
      },
      { signal: controller.signal },
    );

    await expect(
      context.registerTool({
        name: "fallback_abort",
        description: "Duplicate",
        inputSchema: { type: "object" },
        execute: async () => ({ content: [] }),
      }),
    ).rejects.toMatchObject({ name: "InvalidStateError" });

    controller.abort();

    expect(changes).toHaveBeenCalledTimes(2);
    await expect(context.getTools()).resolves.not.toContainEqual(
      expect.objectContaining({ name: "fallback_abort" }),
    );
  });

  it("dispatches JSON input to the live tool and makes aborted bridge handles stale", async () => {
    const context = getOrCreateFallbackModelContext();
    const controller = new AbortController();
    controllers.push(controller);
    const execute = vi.fn(async (params: Record<string, unknown>) => ({
      content: [{ type: "text", text: String(params.query) }],
    }));
    await context.registerTool(
      {
        name: "fallback_execute",
        description: "Search",
        inputSchema: { type: "object" },
        execute,
      },
      { signal: controller.signal },
    );
    const bridge = new LocalBridgeContent({
      getConsumer: () => context,
      getTitle: () => "Example",
      getUrl: () => "https://example.com/page",
    });
    bridge.installToolChangeListener();

    const listed = await bridge.handleMessage({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "webmcp-today:local-bridge:list-tools",
    });
    if (!listed.ok || !("tools" in listed)) throw new Error("Expected tools");

    const executed = await bridge.handleMessage({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "webmcp-today:local-bridge:execute-tool",
      documentGeneration: listed.document.generation,
      toolsGeneration: listed.document.toolsGeneration,
      toolName: "fallback_execute",
      toolOrigin: origin,
      inputJson: '{"query":"coffee"}',
    });
    expect(executed).toMatchObject({ ok: true, result: { content: [{ text: "coffee" }] } });
    expect(execute).toHaveBeenCalledWith({ query: "coffee" });

    controller.abort();
    await expect(
      bridge.handleMessage({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "webmcp-today:local-bridge:execute-tool",
        documentGeneration: listed.document.generation,
        toolsGeneration: listed.document.toolsGeneration,
        toolName: "fallback_execute",
        toolOrigin: origin,
        inputJson: "{}",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "stale-tool" } });
  });

  it("fails closed when Permissions Policy reports that tools are disallowed", async () => {
    vi.stubGlobal("document", {
      permissionsPolicy: {
        allowsFeature: (feature: string) => (feature === "tools" ? false : true),
        features: () => ["tools"],
      },
    });
    const context = getOrCreateFallbackModelContext();

    await expect(
      context.registerTool({
        name: "fallback_blocked",
        description: "Blocked",
        inputSchema: { type: "object" },
        execute: async () => ({ content: [] }),
      }),
    ).rejects.toMatchObject({ name: "SecurityError" });
  });

  it("bypasses an unavailable tools policy feature", async () => {
    vi.stubGlobal("document", {
      permissionsPolicy: {
        allowsFeature: () => false,
        features: () => [],
      },
    });
    const context = getOrCreateFallbackModelContext();
    const controller = new AbortController();
    controllers.push(controller);

    await expect(
      context.registerTool(
        {
          name: "fallback_unknown_policy",
          description: "Available through the bridge",
          inputSchema: { type: "object" },
          execute: async () => ({ content: [] }),
        },
        { signal: controller.signal },
      ),
    ).resolves.toBeUndefined();
  });
});
