import { lstat, mkdtemp, readFile, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import { connect, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { LOCAL_BRIDGE_PROTOCOL_VERSION } from "@robertn702/webmcp-today-schema";
import { LocalBridgeClient } from "../src/local-bridge-client.js";
import { NativeHost } from "../src/native-host.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function nativeMessage(stream: PassThrough): Promise<unknown> {
  return new Promise((resolve) => {
    let buffer = Buffer.alloc(0);
    stream.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 4) return;
      const length = buffer.readUInt32LE(0);
      if (buffer.length < 4 + length) return;
      resolve(JSON.parse(buffer.subarray(4, 4 + length).toString("utf8")));
    });
  });
}

function socketMessage(socket: Socket): Promise<unknown> {
  return new Promise((resolve) => {
    let buffer = "";
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const line = buffer.split("\n")[0];
      if (!line) return;
      resolve(JSON.parse(line));
    });
  });
}

function socketClosed(socket: Socket): Promise<void> {
  return new Promise((resolve) => socket.once("close", () => resolve()));
}

function recordNativeMessages(stream: PassThrough): unknown[] {
  const messages: unknown[] = [];
  let buffer = Buffer.alloc(0);
  stream.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0);
      if (buffer.length < 4 + length) return;
      messages.push(JSON.parse(buffer.subarray(4, 4 + length).toString("utf8")));
      buffer = buffer.subarray(4 + length);
    }
  });
  return messages;
}

function openSocket(path: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(path);
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function writeSocket(socket: Socket, message: unknown): void {
  socket.write(`${JSON.stringify(message)}\n`);
}

function writeNativeFrame(stream: PassThrough, message: unknown): void {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32LE(payload.length, 0);
  stream.write(Buffer.concat([prefix, payload]));
}

function bridgeClient(configurationPath: string, requestTimeoutMs = 10_000): LocalBridgeClient {
  return new LocalBridgeClient(configurationPath, {
    connectSocket: (path) => connect(path),
    readConfiguration: async (path) => JSON.parse(await readFile(path, "utf8")),
    requestTimeoutMs,
  });
}

function executeRequest() {
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

function dispatchAcknowledgement(requestId = "request") {
  return {
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type: "dispatch-ack",
    requestId,
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

describe("NativeHost", () => {
  it("keeps serving peers after a socket reset", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const ready = nativeMessage(stdout);
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "bridge.sock"),
      configurationPath: join(directory, "bridge.json"),
      secret: "s".repeat(32),
      stdin,
      stdout,
    });
    const run = host.run();
    await expect(ready).resolves.toMatchObject({ type: "bridge-ready" });
    const configuration = JSON.parse(await readFile(join(directory, "bridge.json"), "utf8"));

    const resetPeer = await openSocket(configuration.socketPath);
    resetPeer.on("error", () => {});
    writeSocket(resetPeer, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "socket-hello",
      role: "mcp-server",
      secret: configuration.secret,
    });
    resetPeer.destroy(new Error("peer reset"));

    const peer = await openSocket(configuration.socketPath);
    const accepted = socketMessage(peer);
    writeSocket(peer, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "socket-hello",
      role: "mcp-server",
      secret: configuration.secret,
    });
    await expect(accepted).resolves.toMatchObject({ type: "socket-accepted" });

    stdin.end();
    await expect(run).resolves.toBeUndefined();
  });

  it("fails pending sockets and removes artifacts when Chrome closes stdin", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const ready = nativeMessage(stdout);
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "bridge.sock"),
      configurationPath: join(directory, "bridge.json"),
      secret: "s".repeat(32),
      stdin,
      stdout,
    });
    const run = host.run();
    await ready;
    const socketPath = join(directory, "bridge.sock");
    const configurationPath = join(directory, "bridge.json");
    const configuration = JSON.parse(await readFile(configurationPath, "utf8"));
    const configurationArtifactPath = await readlink(configurationPath);
    expect((await stat(configurationArtifactPath)).mode & 0o777).toBe(0o600);
    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    const socket = await openSocket(configuration.socketPath);
    const accepted = socketMessage(socket);
    writeSocket(socket, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "socket-hello",
      role: "mcp-server",
      secret: configuration.secret,
    });
    await accepted;
    const nativeRequest = nativeMessage(stdout);
    writeSocket(socket, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "list-tabs",
      requestId: "request",
    });
    await expect(nativeRequest).resolves.toMatchObject({ type: "list-tabs", requestId: "request" });
    const response = socketMessage(socket);

    stdin.end();

    await expect(response).resolves.toMatchObject({
      type: "error",
      requestId: "request",
      error: { code: "bridge-unavailable" },
    });
    await expect(run).resolves.toBeUndefined();
    await expect(readFile(socketPath)).rejects.toThrow();
    expect((await lstat(configurationPath)).isSymbolicLink()).toBe(true);
    await expect(readlink(configurationPath)).resolves.toBe(configurationArtifactPath);
    await expect(readFile(configurationArtifactPath)).rejects.toThrow();
    await expect(bridgeClient(configurationPath).request(executeRequest())).resolves.toMatchObject({
      type: "error",
      error: { code: "bridge-unavailable" },
    });
  });

  it("fails a request when the native output transport terminates", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const ready = nativeMessage(stdout);
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "bridge.sock"),
      configurationPath: join(directory, "bridge.json"),
      secret: "s".repeat(32),
      stdin,
      stdout,
    });
    const run = host.run();
    await ready;
    const configuration = JSON.parse(await readFile(join(directory, "bridge.json"), "utf8"));
    const socket = await openSocket(configuration.socketPath);
    const accepted = socketMessage(socket);
    writeSocket(socket, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "socket-hello",
      role: "mcp-server",
      secret: configuration.secret,
    });
    await accepted;
    const nativeRequest = nativeMessage(stdout);
    writeSocket(socket, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "list-tabs",
      requestId: "request",
    });
    await expect(nativeRequest).resolves.toMatchObject({ type: "list-tabs", requestId: "request" });
    const response = socketMessage(socket);
    stdout.emit("error", new Error("Chrome disconnected"));

    await expect(response).resolves.toMatchObject({
      type: "error",
      requestId: "request",
      error: { code: "bridge-unavailable" },
    });
    await expect(run).resolves.toBeUndefined();
  });

  it("returns dispatch-failed when the Chrome write definitely fails after the marker", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const configurationPath = join(directory, "bridge.json");
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "bridge.sock"),
      configurationPath,
      secret: "s".repeat(32),
      stdin,
      stdout,
    });
    const run = host.run();
    await nativeMessage(stdout);
    stdout.write = () => {
      throw new Error("Chrome disconnected before dispatch");
    };

    await expect(bridgeClient(configurationPath).request(executeRequest())).resolves.toMatchObject({
      type: "error",
      requestId: "request",
      error: { code: "dispatch-failed" },
    });
    await expect(run).resolves.toBeUndefined();
  });

  it("returns dispatch-failed after a valid acknowledgement when Chrome rejects the write", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const configurationPath = join(directory, "bridge.json");
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "bridge.sock"),
      configurationPath,
      secret: "s".repeat(32),
      stdin,
      stdout,
    });
    const run = host.run();
    await nativeMessage(stdout);
    stdout.write = () => {
      throw new Error("Chrome disconnected before dispatch");
    };

    await expect(bridgeClient(configurationPath).request(executeRequest())).resolves.toMatchObject({
      type: "error",
      requestId: "request",
      error: { code: "dispatch-failed" },
    });
    await expect(run).resolves.toBeUndefined();
  });

  it("does not dispatch an execution when the pre-dispatch marker cannot be delivered", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const configurationPath = join(directory, "bridge.json");
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "bridge.sock"),
      configurationPath,
      secret: "s".repeat(32),
      stdin,
      stdout,
      sendSocketMessage: (socket, message) => {
        if (
          typeof message === "object" &&
          message !== null &&
          Reflect.get(message, "type") === "request-dispatching"
        ) {
          return false;
        }
        socket.write(`${JSON.stringify(message)}\n`);
        return true;
      },
    });
    const run = host.run();
    await nativeMessage(stdout);
    const nativeRequest = nativeMessage(stdout);

    await expect(
      bridgeClient(configurationPath, 20).request(executeRequest()),
    ).resolves.toMatchObject({
      type: "error",
      error: { code: "bridge-unavailable" },
    });
    const notDispatched = Promise.race([
      nativeRequest.then(() => "dispatched"),
      new Promise((resolve) => setTimeout(() => resolve("not-dispatched"), 30)),
    ]);
    await expect(notDispatched).resolves.toBe("not-dispatched");
    stdin.end();
    await expect(run).resolves.toBeUndefined();
  });

  it("does not dispatch before the MCP client acknowledges the prepare marker", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const messages = recordNativeMessages(stdout);
    const configurationPath = join(directory, "bridge.json");
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "bridge.sock"),
      configurationPath,
      secret: "s".repeat(32),
      stdin,
      stdout,
      prepareAckTimeoutMs: 20,
    });
    const run = host.run();
    await nativeMessage(stdout);
    const configuration = JSON.parse(await readFile(configurationPath, "utf8"));
    const socket = await openSocket(configuration.socketPath);
    const accepted = socketMessage(socket);
    writeSocket(socket, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "socket-hello",
      role: "mcp-server",
      secret: configuration.secret,
    });
    await accepted;
    const marker = socketMessage(socket);
    writeSocket(socket, executeRequest());
    await expect(marker).resolves.toMatchObject({ type: "request-dispatching" });
    const response = socketMessage(socket);

    await expect(response).resolves.toMatchObject({
      type: "error",
      requestId: "request",
      error: { code: "dispatch-failed" },
    });
    expect(
      messages.filter((message) => Reflect.get(message, "type") === "execute-tool"),
    ).toHaveLength(0);
    stdin.end();
    await expect(run).resolves.toBeUndefined();
  });

  it("rejects malformed, mismatched, and cross-socket acknowledgements without dispatching", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const messages = recordNativeMessages(stdout);
    const configurationPath = join(directory, "bridge.json");
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "bridge.sock"),
      configurationPath,
      secret: "s".repeat(32),
      stdin,
      stdout,
      prepareAckTimeoutMs: 20,
    });
    const run = host.run();
    await nativeMessage(stdout);
    const configuration = JSON.parse(await readFile(configurationPath, "utf8"));

    for (const acknowledgement of [
      "not-json\n",
      `${JSON.stringify(dispatchAcknowledgement("other"))}\n`,
    ]) {
      const socket = await openSocket(configuration.socketPath);
      const accepted = socketMessage(socket);
      writeSocket(socket, {
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "socket-hello",
        role: "mcp-server",
        secret: configuration.secret,
      });
      await accepted;
      const marker = socketMessage(socket);
      const closed = socketClosed(socket);
      writeSocket(socket, executeRequest());
      await expect(marker).resolves.toMatchObject({ type: "request-dispatching" });
      socket.write(acknowledgement);
      await closed;
    }

    const requestSocket = await openSocket(configuration.socketPath);
    const accepted = socketMessage(requestSocket);
    writeSocket(requestSocket, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "socket-hello",
      role: "mcp-server",
      secret: configuration.secret,
    });
    await accepted;
    const marker = socketMessage(requestSocket);
    writeSocket(requestSocket, executeRequest());
    await marker;
    const otherSocket = await openSocket(configuration.socketPath);
    const otherAccepted = socketMessage(otherSocket);
    writeSocket(otherSocket, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "socket-hello",
      role: "mcp-server",
      secret: configuration.secret,
    });
    await otherAccepted;
    const otherClosed = socketClosed(otherSocket);
    writeSocket(otherSocket, dispatchAcknowledgement());
    await otherClosed;
    const response = socketMessage(requestSocket);

    await expect(response).resolves.toMatchObject({ error: { code: "dispatch-failed" } });
    expect(
      messages.filter((message) => Reflect.get(message, "type") === "execute-tool"),
    ).toHaveLength(0);
    stdin.end();
    await expect(run).resolves.toBeUndefined();
  });

  it("dispatches a split acknowledgement exactly once and rejects a duplicate", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const messages = recordNativeMessages(stdout);
    const configurationPath = join(directory, "bridge.json");
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "bridge.sock"),
      configurationPath,
      secret: "s".repeat(32),
      stdin,
      stdout,
    });
    const run = host.run();
    await nativeMessage(stdout);
    const configuration = JSON.parse(await readFile(configurationPath, "utf8"));
    const socket = await openSocket(configuration.socketPath);
    const accepted = socketMessage(socket);
    writeSocket(socket, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "socket-hello",
      role: "mcp-server",
      secret: configuration.secret,
    });
    await accepted;
    const marker = socketMessage(socket);
    writeSocket(socket, executeRequest());
    await marker;
    const acknowledgement = `${JSON.stringify(dispatchAcknowledgement())}\n`;
    socket.write(acknowledgement.slice(0, 10));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(
      messages.filter((message) => Reflect.get(message, "type") === "execute-tool"),
    ).toHaveLength(0);
    socket.write(acknowledgement.slice(10));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(
      messages.filter((message) => Reflect.get(message, "type") === "execute-tool"),
    ).toHaveLength(1);
    const closed = socketClosed(socket);
    writeSocket(socket, dispatchAcknowledgement());
    await closed;
    expect(
      messages.filter((message) => Reflect.get(message, "type") === "execute-tool"),
    ).toHaveLength(1);
    stdin.end();
    await expect(run).resolves.toBeUndefined();
  });

  it("returns execution-timeout when Chrome disconnects after an execution dispatch", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const configurationPath = join(directory, "bridge.json");
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "bridge.sock"),
      configurationPath,
      secret: "s".repeat(32),
      stdin,
      stdout,
    });
    const run = host.run();
    await nativeMessage(stdout);
    const nativeRequest = nativeMessage(stdout);
    const result = bridgeClient(configurationPath).request(executeRequest());
    await expect(nativeRequest).resolves.toMatchObject({
      type: "execute-tool",
      requestId: "request",
    });

    stdout.emit("error", new Error("Chrome disconnected"));

    await expect(result).resolves.toMatchObject({
      type: "error",
      requestId: "request",
      error: { code: "execution-timeout" },
    });
    await expect(run).resolves.toBeUndefined();
  });

  it("returns execution-timeout when a marked execution outlives the local wait", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const configurationPath = join(directory, "bridge.json");
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "bridge.sock"),
      configurationPath,
      secret: "s".repeat(32),
      stdin,
      stdout,
    });
    const run = host.run();
    await nativeMessage(stdout);
    const nativeRequest = nativeMessage(stdout);
    const result = bridgeClient(configurationPath, 20).request(executeRequest());
    await expect(nativeRequest).resolves.toMatchObject({
      type: "execute-tool",
      requestId: "request",
    });

    await expect(result).resolves.toMatchObject({
      type: "error",
      requestId: "request",
      error: { code: "execution-timeout" },
    });
    stdin.end();
    await expect(run).resolves.toBeUndefined();
  });

  it("returns a successful response after dispatching an execution", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const configurationPath = join(directory, "bridge.json");
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "bridge.sock"),
      configurationPath,
      secret: "s".repeat(32),
      stdin,
      stdout,
    });
    const run = host.run();
    await nativeMessage(stdout);
    const nativeRequest = nativeMessage(stdout);
    const result = bridgeClient(configurationPath).request(executeRequest());
    await expect(nativeRequest).resolves.toMatchObject({
      type: "execute-tool",
      requestId: "request",
    });

    writeNativeFrame(stdin, toolResult());

    await expect(result).resolves.toMatchObject({ type: "tool-result", result: { ok: true } });
    stdin.end();
    await expect(run).resolves.toBeUndefined();
  });

  it("returns a correlated protocol failure for an invalid native response", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const ready = nativeMessage(stdout);
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "bridge.sock"),
      configurationPath: join(directory, "bridge.json"),
      secret: "s".repeat(32),
      stdin,
      stdout,
    });
    const run = host.run();
    await ready;
    const configuration = JSON.parse(await readFile(join(directory, "bridge.json"), "utf8"));
    const socket = await openSocket(configuration.socketPath);
    const accepted = socketMessage(socket);
    writeSocket(socket, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "socket-hello",
      role: "mcp-server",
      secret: configuration.secret,
    });
    await accepted;
    const nativeRequest = nativeMessage(stdout);
    writeSocket(socket, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "list-tabs",
      requestId: "request",
    });
    await expect(nativeRequest).resolves.toMatchObject({ type: "list-tabs", requestId: "request" });
    const response = socketMessage(socket);

    writeNativeFrame(stdin, { v: 2, type: "tabs", requestId: "request", tabs: [] });

    await expect(response).resolves.toMatchObject({
      type: "error",
      requestId: "request",
      error: { code: "protocol-mismatch" },
    });
    stdin.end();
    await expect(run).resolves.toBeUndefined();
  });

  it("leaves a successor publication untouched when a predecessor retires", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const ready = nativeMessage(stdout);
    const socketPath = join(directory, "bridge.sock");
    const successorSocketPath = join(directory, "successor.sock");
    const configurationPath = join(directory, "bridge.json");
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath,
      configurationPath,
      secret: "s".repeat(32),
      stdin,
      stdout,
    });
    const run = host.run();
    await ready;

    const successorInput = new PassThrough();
    const successorOutput = new PassThrough();
    const successorReady = nativeMessage(successorOutput);
    const successor = new NativeHost({
      configurationDirectory: directory,
      socketPath: successorSocketPath,
      configurationPath,
      secret: "t".repeat(32),
      stdin: successorInput,
      stdout: successorOutput,
    });
    const successorRun = successor.run();
    await successorReady;

    stdin.end();

    await expect(run).resolves.toBeUndefined();
    await expect(readFile(configurationPath, "utf8")).resolves.toContain("t".repeat(32));
    const successorRequest = nativeMessage(successorOutput);
    const successorResponse = bridgeClient(configurationPath).request({
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "list-tabs",
      requestId: "successor-request",
    });
    await expect(successorRequest).resolves.toMatchObject({
      type: "list-tabs",
      requestId: "successor-request",
    });
    writeNativeFrame(successorInput, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "tabs",
      requestId: "successor-request",
      tabs: [],
    });
    await expect(successorResponse).resolves.toMatchObject({ type: "tabs", tabs: [] });
    successorInput.end();
    await expect(successorRun).resolves.toBeUndefined();
  });

  it("replaces a stale publication from a crash-like orphan", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const configurationPath = join(directory, "bridge.json");
    const orphanConfigurationPath = join(directory, "bridge-orphan");
    await writeFile(
      orphanConfigurationPath,
      `${JSON.stringify({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        socketPath: join(directory, "orphan.sock"),
        secret: "o".repeat(32),
      })}\n`,
      { mode: 0o600 },
    );
    await symlink(orphanConfigurationPath, configurationPath);
    await expect(bridgeClient(configurationPath).request(executeRequest())).resolves.toMatchObject({
      type: "error",
      error: { code: "bridge-unavailable" },
    });

    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "successor.sock"),
      configurationPath,
      secret: "s".repeat(32),
      stdin,
      stdout,
    });
    const run = host.run();

    await expect(nativeMessage(stdout)).resolves.toMatchObject({ type: "bridge-ready" });
    await expect(readFile(configurationPath, "utf8")).resolves.toContain("s".repeat(32));
    await expect(readFile(orphanConfigurationPath, "utf8")).resolves.toContain("o".repeat(32));
    stdin.end();
    await expect(run).resolves.toBeUndefined();
  });

  it("serves only complete configurations while replacing a prior publication", async () => {
    const directory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(directory);
    const configurationPath = join(directory, "bridge.json");
    const oldConfigurationPath = join(directory, "bridge-old");
    await writeFile(
      oldConfigurationPath,
      `${JSON.stringify({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        socketPath: join(directory, "old.sock"),
        secret: "o".repeat(32),
      })}\n`,
      { mode: 0o600 },
    );
    await symlink(oldConfigurationPath, configurationPath);

    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const host = new NativeHost({
      configurationDirectory: directory,
      socketPath: join(directory, "new.sock"),
      configurationPath,
      secret: "n".repeat(32),
      stdin,
      stdout,
    });
    const run = host.run();
    const reads = Promise.all(
      Array.from({ length: 100 }, async () =>
        JSON.parse(await readFile(configurationPath, "utf8")),
      ),
    );

    await expect(nativeMessage(stdout)).resolves.toMatchObject({ type: "bridge-ready" });
    for (const configuration of await reads) {
      expect(configuration).toMatchObject({ v: LOCAL_BRIDGE_PROTOCOL_VERSION });
      expect(typeof configuration.socketPath).toBe("string");
      expect(typeof configuration.secret).toBe("string");
    }
    stdin.end();
    await expect(run).resolves.toBeUndefined();
  });
});
