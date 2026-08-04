import { describe, expect, it, vi } from "vitest";
import { LOCAL_BRIDGE_PROTOCOL_VERSION } from "@webmcp-today/schema";
import { startNativeBridge, type NativePortLike } from "../src/lib/native-bridge.js";
import { createLocalBridgeRouter } from "../src/lib/local-bridge-router.js";

describe("native bridge", () => {
  it("routes valid requests and posts validated responses", async () => {
    let messageListener: ((message: unknown) => void) | undefined;
    let disconnectListener: (() => void) | undefined;
    const postMessage = vi.fn();
    const port: NativePortLike = {
      onMessage: { addListener: (listener) => (messageListener = listener) },
      onDisconnect: { addListener: (listener) => (disconnectListener = listener) },
      postMessage,
    };
    const handle = vi.fn(async () => ({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "tabs",
      requestId: "request",
      tabs: [],
    }));
    startNativeBridge({ connectNative: () => port, handle, scheduleReconnect: () => {} });

    messageListener?.({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "list-tabs",
      requestId: "request",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(handle).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "tabs" }));
    expect(disconnectListener).toBeDefined();
  });

  it("returns a structured failure when the router rejects", async () => {
    let messageListener: ((message: unknown) => void) | undefined;
    const postMessage = vi.fn();
    const port: NativePortLike = {
      onMessage: { addListener: (listener) => (messageListener = listener) },
      onDisconnect: { addListener: () => {} },
      postMessage,
    };
    startNativeBridge({
      connectNative: () => port,
      handle: async () => {
        throw new Error("content script disconnected");
      },
      scheduleReconnect: () => {},
    });

    messageListener?.({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "list-tabs",
      requestId: "request",
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        requestId: "request",
        error: expect.objectContaining({ code: "bridge-unavailable" }),
      }),
    );
  });

  it("returns a correlated protocol failure for a version-mismatched request", async () => {
    let messageListener: ((message: unknown) => void) | undefined;
    const postMessage = vi.fn();
    const port: NativePortLike = {
      onMessage: { addListener: (listener) => (messageListener = listener) },
      onDisconnect: { addListener: () => {} },
      postMessage,
    };
    const router = createLocalBridgeRouter({
      getSelectedTabId: async () => undefined,
      sendToContent: async () => undefined,
    });
    startNativeBridge({
      connectNative: () => port,
      handle: router.handle,
      scheduleReconnect: () => {},
    });

    messageListener?.({ v: 2, type: "list-tabs", requestId: "request" });
    await Promise.resolve();
    await Promise.resolve();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        requestId: "request",
        error: expect.objectContaining({ code: "protocol-mismatch" }),
      }),
    );
  });

  it("closes the port lifecycle when posting fails", async () => {
    let messageListener: ((message: unknown) => void) | undefined;
    const scheduleReconnect = vi.fn();
    const port: NativePortLike = {
      onMessage: { addListener: (listener) => (messageListener = listener) },
      onDisconnect: { addListener: () => {} },
      postMessage: () => {
        throw new Error("native port is disconnected");
      },
    };
    startNativeBridge({
      connectNative: () => port,
      handle: async () => ({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "tabs",
        requestId: "request",
        tabs: [],
      }),
      scheduleReconnect,
    });

    messageListener?.({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "list-tabs",
      requestId: "request",
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(scheduleReconnect).toHaveBeenCalledTimes(1);
  });

  it("does not post a response after the native port disconnects", async () => {
    let messageListener: ((message: unknown) => void) | undefined;
    let disconnectListener: (() => void) | undefined;
    const postMessage = vi.fn();
    const scheduleReconnect = vi.fn();
    const port: NativePortLike = {
      onMessage: { addListener: (listener) => (messageListener = listener) },
      onDisconnect: { addListener: (listener) => (disconnectListener = listener) },
      postMessage,
    };
    startNativeBridge({
      connectNative: () => port,
      handle: async () => ({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "tabs",
        requestId: "request",
        tabs: [],
      }),
      scheduleReconnect,
    });

    disconnectListener?.();
    messageListener?.({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "list-tabs",
      requestId: "request",
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(postMessage).not.toHaveBeenCalled();
    expect(scheduleReconnect).toHaveBeenCalledTimes(1);
  });
});
