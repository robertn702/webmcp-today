import { describe, expect, it } from "vitest";
import {
  LOCAL_BRIDGE_PROTOCOL_VERSION,
  contentBridgeExecuteToolRequestSchema,
  jsonValueSchema,
  localBridgeErrorCodeSchema,
  localBridgeSocketDispatchAckSchema,
  localBridgeSocketDispatchingSchema,
  localBridgeToolDescriptorSchema,
  localBridgeRequestSchema,
  localBridgeResponseSchema,
} from "../src/index.js";

describe("local bridge schemas", () => {
  it("keeps the local bridge protocol at version 1", () => {
    expect(LOCAL_BRIDGE_PROTOCOL_VERSION).toBe(1);
  });

  it("accepts the explicit uncertain execution timeout error", () => {
    expect(localBridgeErrorCodeSchema.safeParse("execution-timeout").success).toBe(true);
  });

  it("accepts the definite non-execution dispatch failure", () => {
    expect(localBridgeErrorCodeSchema.safeParse("dispatch-failed").success).toBe(true);
  });

  it("accepts a correlated native-host pre-dispatch marker", () => {
    expect(
      localBridgeSocketDispatchingSchema.safeParse({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "request-dispatching",
        requestId: "request",
      }).success,
    ).toBe(true);
  });

  it("accepts a correlated MCP-client dispatch acknowledgement", () => {
    expect(
      localBridgeSocketDispatchAckSchema.safeParse({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "dispatch-ack",
        requestId: "request",
      }).success,
    ).toBe(true);
  });

  it("accepts a versioned execution request with a JSON object input", () => {
    expect(
      contentBridgeExecuteToolRequestSchema.safeParse({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "webmcp-today:local-bridge:execute-tool",
        documentGeneration: "document",
        toolsGeneration: "tools",
        toolName: "search",
        toolOrigin: "https://example.com",
        inputJson: '{"query":"coffee"}',
      }).success,
    ).toBe(true);
  });

  it("rejects non-object and invalid JSON execution inputs", () => {
    const base = {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "webmcp-today:local-bridge:execute-tool",
      documentGeneration: "document",
      toolsGeneration: "tools",
      toolName: "search",
      toolOrigin: "https://example.com",
    };
    expect(
      contentBridgeExecuteToolRequestSchema.safeParse({ ...base, inputJson: "[]" }).success,
    ).toBe(false);
    expect(
      contentBridgeExecuteToolRequestSchema.safeParse({ ...base, inputJson: "not-json" }).success,
    ).toBe(false);
  });

  it("accepts a descriptor without an input schema for a no-argument WebMCP tool", () => {
    expect(
      localBridgeToolDescriptorSchema.safeParse({
        name: "ping",
        description: "Check availability",
        origin: "https://example.com",
      }).success,
    ).toBe(true);
  });

  it("accepts only serializable native requests and results", () => {
    expect(
      localBridgeRequestSchema.safeParse({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "list-tools",
        requestId: "request",
        tabId: 4,
      }).success,
    ).toBe(true);
    expect(
      localBridgeResponseSchema.safeParse({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "tool-result",
        requestId: "request",
        tabId: 4,
        document: {
          generation: "document",
          toolsGeneration: "tools",
          title: "Example",
          url: "https://example.com",
        },
        result: { content: [{ type: "text", text: "ok" }] },
      }).success,
    ).toBe(true);
    expect(jsonValueSchema.safeParse(new Date()).success).toBe(false);
  });
});
