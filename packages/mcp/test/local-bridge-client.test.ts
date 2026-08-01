import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { LOCAL_BRIDGE_PROTOCOL_VERSION } from "@robertn702/webmcp-today-schema";
import { LocalBridgeClient } from "../src/local-bridge-client.js";

class FakeSocket extends EventEmitter {
  readonly writes: string[] = [];
  destroyed = false;
  setEncoding(): this {
    return this;
  }
  write(value: string): boolean {
    this.writes.push(value);
    return true;
  }
  end(): this {
    return this;
  }
  destroy(): this {
    this.destroyed = true;
    return this;
  }
}

function clientFor(socket: FakeSocket, requestTimeoutMs?: number) {
  return new LocalBridgeClient("/bridge.json", {
    connectSocket: () => socket,
    readConfiguration: async () => ({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      socketPath: "/bridge.sock",
      secret: "s".repeat(32),
    }),
    requestTimeoutMs,
  });
}

function request() {
  return { v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "list-tabs" as const, requestId: "request" };
}

function executionRequest() {
  return {
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type: "execute-tool" as const,
    requestId: "request",
    tabId: 1,
    documentGeneration: "document",
    toolsGeneration: "tools",
    toolName: "write",
    toolOrigin: "https://example.com",
    inputJson: "{}",
  };
}

function dispatchMarker() {
  return {
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type: "request-dispatching",
    requestId: "request",
  };
}

function toolResult() {
  return {
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type: "tool-result",
    requestId: "request",
    tabId: 1,
    document: {
      generation: "document",
      toolsGeneration: "tools",
      title: "Example",
      url: "https://example.com",
    },
    result: { ok: true },
  };
}

describe("LocalBridgeClient", () => {
  it("fails closed when bridge configuration cannot be read", async () => {
    const client = new LocalBridgeClient("/missing", {
      connectSocket: () => new FakeSocket(),
      readConfiguration: async () => {
        throw new Error("missing");
      },
    });
    await expect(
      client.request({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "list-tabs", requestId: "request" }),
    ).resolves.toMatchObject({ type: "error", error: { code: "bridge-unavailable" } });
  });

  it("authenticates the private socket before sending the native request", async () => {
    const socket = new FakeSocket();
    const client = clientFor(socket);
    const result = client.request(request());
    await Promise.resolve();
    socket.emit("connect");
    await Promise.resolve();
    socket.emit(
      "data",
      `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
    );
    await Promise.resolve();
    socket.emit(
      "data",
      `${JSON.stringify({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "tabs",
        requestId: "request",
        tabs: [],
      })}\n`,
    );

    await expect(result).resolves.toMatchObject({ type: "tabs", tabs: [] });
    expect(JSON.parse(socket.writes[0] ?? "{}")).toMatchObject({ type: "socket-hello" });
    expect(JSON.parse(socket.writes[1] ?? "{}")).toMatchObject({ type: "list-tabs" });
  });

  it("returns bridge-unavailable after a bounded silent-host timeout", async () => {
    vi.useFakeTimers();
    try {
      const socket = new FakeSocket();
      const result = clientFor(socket, 25).request(request());

      await vi.advanceTimersByTimeAsync(25);

      await expect(result).resolves.toMatchObject({
        type: "error",
        error: { code: "bridge-unavailable" },
      });
      expect(socket.destroyed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns execution-timeout after a native-host dispatch marker times out", async () => {
    vi.useFakeTimers();
    try {
      const socket = new FakeSocket();
      const result = clientFor(socket, 25).request(executionRequest());
      await Promise.resolve();
      socket.emit("connect");
      socket.emit(
        "data",
        `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
      );
      socket.emit("data", `${JSON.stringify(dispatchMarker())}\n`);
      await Promise.resolve();

      expect(JSON.parse(socket.writes[1] ?? "{}")).toMatchObject({ type: "execute-tool" });
      expect(JSON.parse(socket.writes[2] ?? "{}")).toMatchObject({
        type: "dispatch-ack",
        requestId: "request",
      });
      await vi.advanceTimersByTimeAsync(25);

      await expect(result).resolves.toMatchObject({
        type: "error",
        error: { code: "execution-timeout" },
      });
      expect(socket.destroyed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns execution-timeout after a marked execution socket closes", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(executionRequest());
    await Promise.resolve();
    socket.emit("connect");
    socket.emit(
      "data",
      `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
    );
    socket.emit("data", `${JSON.stringify(dispatchMarker())}\n`);
    await Promise.resolve();

    socket.emit("close");

    await expect(result).resolves.toMatchObject({
      type: "error",
      error: { code: "execution-timeout" },
    });
  });

  it("returns execution-timeout after a marked execution socket errors", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(executionRequest());
    await Promise.resolve();
    socket.emit("connect");
    socket.emit(
      "data",
      `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
    );
    socket.emit("data", `${JSON.stringify(dispatchMarker())}\n`);
    socket.emit("error", new Error("socket failed"));

    await expect(result).resolves.toMatchObject({
      type: "error",
      error: { code: "execution-timeout" },
    });
  });

  it("returns execution-timeout after a marked execution socket ends", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(executionRequest());
    await Promise.resolve();
    socket.emit("connect");
    socket.emit(
      "data",
      `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
    );
    socket.emit("data", `${JSON.stringify(dispatchMarker())}\n`);
    socket.emit("end");

    await expect(result).resolves.toMatchObject({
      type: "error",
      error: { code: "execution-timeout" },
    });
  });

  it("keeps bridge-unavailable for a list request timeout", async () => {
    vi.useFakeTimers();
    try {
      const socket = new FakeSocket();
      const result = clientFor(socket, 25).request(request());
      await Promise.resolve();
      socket.emit("connect");
      socket.emit(
        "data",
        `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
      );
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(25);

      await expect(result).resolves.toMatchObject({
        type: "error",
        error: { code: "bridge-unavailable" },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps bridge-unavailable when an accepted list request disconnects", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(request());
    await Promise.resolve();
    socket.emit("connect");
    socket.emit(
      "data",
      `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
    );
    socket.emit("close");

    await expect(result).resolves.toMatchObject({
      type: "error",
      error: { code: "bridge-unavailable" },
    });
  });

  it("passes through a definite dispatch failure after the marker", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(executionRequest());
    await Promise.resolve();
    socket.emit("connect");
    socket.emit(
      "data",
      `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
    );
    socket.emit(
      "data",
      `${JSON.stringify(dispatchMarker())}\n${JSON.stringify({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "error",
        requestId: "request",
        error: { code: "dispatch-failed", message: "The tool did not run." },
      })}\n`,
    );

    await expect(result).resolves.toMatchObject({
      type: "error",
      error: { code: "dispatch-failed" },
    });
  });

  it("returns execution-timeout for a post-marker host protocol mismatch", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(executionRequest());
    await Promise.resolve();
    socket.emit("connect");
    socket.emit(
      "data",
      `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
    );
    socket.emit(
      "data",
      `${JSON.stringify(dispatchMarker())}\n${JSON.stringify({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "error",
        requestId: "request",
        error: { code: "protocol-mismatch", message: "Extension response was incompatible." },
      })}\n`,
    );

    await expect(result).resolves.toMatchObject({
      type: "error",
      error: { code: "execution-timeout" },
    });
  });

  it("accepts a marker and successful final response in one chunk", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(executionRequest());
    await Promise.resolve();
    socket.emit("connect");
    socket.emit(
      "data",
      `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
    );
    socket.emit("data", `${JSON.stringify(dispatchMarker())}\n${JSON.stringify(toolResult())}\n`);

    await expect(result).resolves.toMatchObject({ type: "tool-result", result: { ok: true } });
    expect(JSON.parse(socket.writes[2] ?? "{}")).toMatchObject({ type: "dispatch-ack" });
  });

  it("rejects a duplicate prepare marker after acknowledging the first", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(executionRequest());
    await Promise.resolve();
    socket.emit("connect");
    socket.emit(
      "data",
      `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
    );
    socket.emit(
      "data",
      `${JSON.stringify(dispatchMarker())}\n${JSON.stringify(dispatchMarker())}\n`,
    );

    await expect(result).resolves.toMatchObject({
      type: "error",
      error: { code: "execution-timeout" },
    });
    expect(socket.destroyed).toBe(true);
  });

  it("accepts a marker and successful final response in split chunks", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(executionRequest());
    await Promise.resolve();
    socket.emit("connect");
    socket.emit(
      "data",
      `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
    );
    socket.emit("data", `${JSON.stringify(dispatchMarker())}\n`);
    socket.emit("data", `${JSON.stringify(toolResult())}\n`);

    await expect(result).resolves.toMatchObject({ type: "tool-result", result: { ok: true } });
  });

  it("returns bridge-unavailable when the socket closes during the handshake", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(request());
    await Promise.resolve();

    socket.emit("close");

    await expect(result).resolves.toMatchObject({
      type: "error",
      error: { code: "bridge-unavailable" },
    });
    expect(socket.destroyed).toBe(true);
  });

  it("returns bridge-unavailable when the socket ends during the handshake", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(request());
    await Promise.resolve();

    socket.emit("end");

    await expect(result).resolves.toMatchObject({
      type: "error",
      error: { code: "bridge-unavailable" },
    });
    expect(socket.destroyed).toBe(true);
  });

  it("returns bridge-unavailable for malformed data before the socket handshake", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(request());
    await Promise.resolve();
    socket.emit("connect");
    socket.emit("data", "not-json\n");

    await expect(result).resolves.toMatchObject({
      type: "error",
      requestId: "request",
      error: { code: "bridge-unavailable" },
    });
    expect(socket.destroyed).toBe(true);
  });

  it("returns a correlated protocol failure for a response with another request ID", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(request());
    await Promise.resolve();
    socket.emit("connect");
    socket.emit(
      "data",
      `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
    );
    socket.emit(
      "data",
      `${JSON.stringify({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "tabs",
        requestId: "other-request",
        tabs: [],
      })}\n`,
    );

    await expect(result).resolves.toMatchObject({
      type: "error",
      requestId: "request",
      error: { code: "protocol-mismatch" },
    });
    expect(socket.destroyed).toBe(true);
  });

  it("returns a correlated protocol failure for malformed data after the handshake", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(request());
    await Promise.resolve();
    socket.emit("connect");
    socket.emit(
      "data",
      `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
    );
    socket.emit("data", "not-json\n");

    await expect(result).resolves.toMatchObject({
      type: "error",
      requestId: "request",
      error: { code: "protocol-mismatch" },
    });
    expect(socket.destroyed).toBe(true);
  });

  it("returns a correlated protocol failure for a version-mismatched socket response", async () => {
    const socket = new FakeSocket();
    const result = clientFor(socket).request(request());
    await Promise.resolve();
    socket.emit("connect");
    socket.emit(
      "data",
      `${JSON.stringify({ v: LOCAL_BRIDGE_PROTOCOL_VERSION, type: "socket-accepted" })}\n`,
    );
    socket.emit(
      "data",
      `${JSON.stringify({ v: 2, type: "tabs", requestId: "request", tabs: [] })}\n`,
    );

    await expect(result).resolves.toMatchObject({
      type: "error",
      requestId: "request",
      error: { code: "protocol-mismatch" },
    });
    expect(socket.destroyed).toBe(true);
  });
});
