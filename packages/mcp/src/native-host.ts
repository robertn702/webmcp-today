#!/usr/bin/env node
import {
  LOCAL_BRIDGE_PROTOCOL_VERSION,
  localBridgeConfigurationSchema,
  localBridgeErrorResponseSchema,
  localBridgeReadySchema,
  localBridgeRequestSchema,
  localBridgeResponseSchema,
  localBridgeSocketAcceptedSchema,
  localBridgeSocketDispatchAckSchema,
  localBridgeSocketDispatchingSchema,
  localBridgeSocketHelloSchema,
} from "@robertn702/webmcp-today-schema";
import { randomBytes } from "node:crypto";
import { chmod, mkdir, rename, symlink, unlink, writeFile } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CONFIGURATION_DIRECTORY = join(homedir(), ".config", "webmcp-today");
const MAX_NATIVE_MESSAGE_BYTES = 1_000_000;
const DEFAULT_PREPARE_ACK_TIMEOUT_MS = 2_000;
const MAX_PREPARE_ACK_TIMEOUT_MS = 10_000;

export interface NativeHostOptions {
  configurationDirectory?: string;
  socketPath?: string;
  configurationPath?: string;
  secret?: string;
  stdin?: NativeInputStream;
  stdout?: NodeJS.WritableStream;
  sendSocketMessage?: (socket: Socket, message: unknown) => boolean;
  /** Testable bound for client acknowledgement of an execute prepare marker. */
  prepareAckTimeoutMs?: number;
}

type NativeInputStream = NodeJS.ReadableStream & { destroy?: () => void };

type PendingRequest = {
  socket: Socket;
  state: "awaiting-ack" | "dispatched";
  nativeMessage: Buffer;
  ackTimeout?: NodeJS.Timeout;
};

/** Owns one Chrome native-messaging session and its private MCP socket. */
export class NativeHost {
  private readonly configurationDirectory: string;
  private readonly socketPath: string;
  private readonly configurationPath: string;
  private readonly configurationArtifactPath: string;
  private readonly configurationLinkPath: string;
  private readonly secret: string;
  private readonly stdin: NativeInputStream;
  private readonly stdout: NodeJS.WritableStream;
  private readonly sendSocketMessage: ((socket: Socket, message: unknown) => boolean) | undefined;
  private readonly prepareAckTimeoutMs: number;
  private readonly requests = new Map<string, PendingRequest>();
  private readonly sockets = new Set<Socket>();
  private server: Server | undefined;
  private accepting = true;
  private shuttingDown: Promise<void> | undefined;

  constructor(options: NativeHostOptions = {}) {
    this.configurationDirectory = options.configurationDirectory ?? DEFAULT_CONFIGURATION_DIRECTORY;
    // Each session owns its pathname, so an old server.close() cannot unlink a
    // newer session's listener while Chrome restarts the MV3 worker.
    this.socketPath =
      options.socketPath ??
      join(this.configurationDirectory, `bridge-${randomBytes(8).toString("hex")}.sock`);
    this.configurationPath =
      options.configurationPath ?? join(this.configurationDirectory, "bridge.json");
    const configurationToken = randomBytes(8).toString("hex");
    this.configurationArtifactPath = join(
      dirname(this.configurationPath),
      `${basename(this.configurationPath)}-${configurationToken}`,
    );
    this.configurationLinkPath = join(
      dirname(this.configurationPath),
      `.${basename(this.configurationPath)}-${configurationToken}`,
    );
    this.secret = options.secret ?? randomBytes(32).toString("base64url");
    this.stdin = options.stdin ?? process.stdin;
    this.stdout = options.stdout ?? process.stdout;
    this.sendSocketMessage = options.sendSocketMessage;
    this.prepareAckTimeoutMs = boundedPrepareAckTimeout(options.prepareAckTimeoutMs);
  }

  async run(): Promise<void> {
    const onStdoutError = () => {
      this.terminate();
    };
    this.stdout.once("error", onStdoutError);
    try {
      await this.start();
      const readyMessage = nativeMessageFrame(
        localBridgeReadySchema.parse({
          v: LOCAL_BRIDGE_PROTOCOL_VERSION,
          type: "bridge-ready",
        }),
      );
      if (!readyMessage || this.writeNativeMessage(readyMessage) !== "written") {
        return;
      }
      for await (const message of nativeMessageStream(this.stdin)) {
        const response = localBridgeResponseSchema.safeParse(message);
        const requestId = response.success
          ? response.data.requestId
          : requestIdFromUnknown(message);
        const pending = this.requests.get(requestId);
        if (!pending || pending.state !== "dispatched") continue;
        this.removeRequest(requestId);
        if (!response.success) {
          this.writeResponseAndClose(pending.socket, protocolMismatchResponse(requestId));
          continue;
        }
        this.writeResponseAndClose(pending.socket, response.data);
      }
    } catch {
      // A framing or transport failure ends this Chrome native-messaging session.
    } finally {
      this.stdout.off("error", onStdoutError);
      await this.shutdown();
    }
  }

  private async start(): Promise<void> {
    await mkdir(this.configurationDirectory, { recursive: true, mode: 0o700 });
    await chmod(this.configurationDirectory, 0o700);
    try {
      await unlink(this.socketPath);
    } catch {
      // The first local bridge session has no stale socket to remove.
    }
    await writeFile(
      this.configurationArtifactPath,
      `${JSON.stringify(
        localBridgeConfigurationSchema.parse({
          v: LOCAL_BRIDGE_PROTOCOL_VERSION,
          socketPath: this.socketPath,
          secret: this.secret,
        }),
      )}\n`,
      { mode: 0o600, flag: "wx" },
    );
    await chmod(this.configurationArtifactPath, 0o600);
    this.server = createServer((socket) => this.handleSocket(socket));
    this.server.on("error", () => {
      this.terminate();
    });
    await new Promise<void>((resolve, reject) => {
      const server = this.server;
      if (!server) {
        reject(new Error("Native bridge server was not created."));
        return;
      }
      const onError = (error: Error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(this.socketPath);
    });
    await chmod(this.socketPath, 0o600);
    try {
      // The socket is live before publication, so a discovered configuration is ready to serve.
      await symlink(this.configurationArtifactPath, this.configurationLinkPath);
      await rename(this.configurationLinkPath, this.configurationPath);
    } catch (error) {
      await removeIfPresent(this.configurationLinkPath);
      throw error;
    }
  }

  private handleSocket(socket: Socket): void {
    if (!this.accepting) {
      socket.destroy();
      return;
    }

    let buffer = "";
    let authenticated = false;
    let requestPending = false;
    this.sockets.add(socket);
    socket.setEncoding("utf8");
    socket.on("error", () => {
      this.removeSocketRequests(socket);
      this.sockets.delete(socket);
    });
    socket.on("close", () => {
      this.removeSocketRequests(socket);
      this.sockets.delete(socket);
    });
    socket.on("data", (chunk: string) => {
      if (!this.accepting) {
        socket.destroy();
        return;
      }
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) continue;
        let message: unknown;
        try {
          message = JSON.parse(line);
        } catch {
          socket.destroy();
          return;
        }
        if (!authenticated) {
          const hello = localBridgeSocketHelloSchema.safeParse(message);
          if (!hello.success || hello.data.secret !== this.secret) {
            socket.destroy();
            return;
          }
          authenticated = true;
          this.writeSocket(
            socket,
            localBridgeSocketAcceptedSchema.parse({
              v: LOCAL_BRIDGE_PROTOCOL_VERSION,
              type: "socket-accepted",
            }),
          );
          continue;
        }
        const acknowledgement = localBridgeSocketDispatchAckSchema.safeParse(message);
        if (acknowledgement.success) {
          this.handleDispatchAcknowledgement(socket, acknowledgement.data.requestId);
          continue;
        }
        const request = localBridgeRequestSchema.safeParse(message);
        if (!request.success || requestPending || this.requests.has(request.data.requestId)) {
          socket.destroy();
          return;
        }
        requestPending = true;
        const nativeMessage = nativeMessageFrame(request.data);
        if (!nativeMessage) {
          this.writeResponseAndClose(
            socket,
            localBridgeErrorResponseSchema.parse({
              v: LOCAL_BRIDGE_PROTOCOL_VERSION,
              type: "error",
              requestId: request.data.requestId,
              error: {
                code: "tool-error",
                message: "Local bridge request exceeded Chrome native messaging's 1 MB limit.",
              },
            }),
          );
          continue;
        }

        if (request.data.type === "execute-tool") {
          // The client must process this marker and acknowledge it before a Chrome
          // write can occur; socket buffering alone cannot establish that ordering.
          const pending: PendingRequest = {
            socket,
            state: "awaiting-ack",
            nativeMessage,
          };
          this.requests.set(request.data.requestId, pending);
          pending.ackTimeout = setTimeout(() => {
            const current = this.requests.get(request.data.requestId);
            if (current !== pending || current.state !== "awaiting-ack") return;
            this.removeRequest(request.data.requestId);
            this.writeResponseAndClose(
              socket,
              dispatchFailedResponse(
                request.data.requestId,
                "The local bridge did not receive Chrome dispatch confirmation from the MCP client. The tool did not run and can be retried.",
              ),
            );
          }, this.prepareAckTimeoutMs);
          pending.ackTimeout.unref();
          const marked = this.writeSocket(
            socket,
            localBridgeSocketDispatchingSchema.parse({
              v: LOCAL_BRIDGE_PROTOCOL_VERSION,
              type: "request-dispatching",
              requestId: request.data.requestId,
            }),
          );
          if (!marked) {
            this.removeRequest(request.data.requestId);
            this.endSocket(socket);
            return;
          }
          continue;
        }

        this.requests.set(request.data.requestId, { socket, state: "dispatched", nativeMessage });
        if (this.writeNativeMessage(nativeMessage) === "written") continue;

        this.removeRequest(request.data.requestId);
        this.terminate();
      }
    });
  }

  private handleDispatchAcknowledgement(socket: Socket, requestId: string): void {
    const pending = this.requests.get(requestId);
    if (!pending || pending.socket !== socket || pending.state !== "awaiting-ack") {
      socket.destroy();
      return;
    }
    if (socket.destroyed || socket.writableEnded || !this.accepting) {
      this.removeRequest(requestId);
      return;
    }
    if (pending.ackTimeout) clearTimeout(pending.ackTimeout);
    // Transition before the write so duplicate acknowledgements cannot dispatch twice.
    pending.state = "dispatched";
    if (this.writeNativeMessage(pending.nativeMessage) === "written") return;

    this.removeRequest(requestId);
    this.writeResponseAndClose(
      socket,
      dispatchFailedResponse(
        requestId,
        "The local bridge could not send the tool call to Chrome. The tool did not run and can be retried.",
      ),
    );
    this.terminate();
  }

  private writeNativeMessage(message: Buffer): "written" | "failed" {
    try {
      this.stdout.write(message);
      return "written";
    } catch {
      return "failed";
    }
  }

  private writeResponseAndClose(socket: Socket, message: unknown): void {
    this.writeSocket(socket, message);
    this.endSocket(socket);
  }

  private writeSocket(socket: Socket, message: unknown): boolean {
    if (this.sendSocketMessage) return this.sendSocketMessage(socket, message);
    if (socket.destroyed || socket.writableEnded) return false;
    try {
      socket.write(`${JSON.stringify(message)}\n`);
      return true;
    } catch {
      this.removeSocketRequests(socket);
      socket.destroy();
      return false;
    }
  }

  private endSocket(socket: Socket): void {
    if (socket.destroyed || socket.writableEnded) return;
    try {
      socket.end();
    } catch {
      socket.destroy();
    }
  }

  private removeSocketRequests(socket: Socket): void {
    for (const [requestId, pending] of this.requests) {
      if (pending.socket === socket) this.removeRequest(requestId);
    }
  }

  private removeRequest(requestId: string): void {
    const pending = this.requests.get(requestId);
    if (!pending) return;
    if (pending.ackTimeout) clearTimeout(pending.ackTimeout);
    this.requests.delete(requestId);
  }

  private async shutdown(): Promise<void> {
    if (this.shuttingDown) return this.shuttingDown;
    this.shuttingDown = this.close();
    return this.shuttingDown;
  }

  private terminate(): void {
    void this.shutdown();
    this.stdin.destroy?.();
  }

  private async close(): Promise<void> {
    this.accepting = false;
    for (const [requestId, pending] of this.requests) {
      this.removeRequest(requestId);
      this.writeResponseAndClose(
        pending.socket,
        pending.state === "awaiting-ack"
          ? dispatchFailedResponse(
              requestId,
              "The local WebMCP bridge stopped before dispatching the tool call. The tool did not run and can be retried.",
            )
          : localBridgeErrorResponseSchema.parse({
              v: LOCAL_BRIDGE_PROTOCOL_VERSION,
              type: "error",
              requestId,
              error: {
                code: "bridge-unavailable",
                message: "The local WebMCP bridge disconnected from Chrome.",
              },
            }),
      );
    }
    for (const socket of this.sockets) {
      this.endSocket(socket);
    }
    await this.closeServer();
    await removeIfPresent(this.socketPath);
    await removeIfPresent(this.configurationLinkPath);
    // Leave the stable symlink untouched. It may now be a successor's publication;
    // when it still points here, it becomes a harmless dangling last-known record.
    await removeIfPresent(this.configurationArtifactPath);
  }

  private async closeServer(): Promise<void> {
    const server = this.server;
    if (!server || !server.listening) return;
    await new Promise<void>((resolve) => {
      let closed = false;
      const finish = () => {
        if (closed) return;
        closed = true;
        clearTimeout(forceClose);
        resolve();
      };
      const forceClose = setTimeout(() => {
        for (const socket of this.sockets) {
          socket.destroy();
        }
        finish();
      }, 500);
      forceClose.unref();
      try {
        server.close(finish);
      } catch {
        finish();
      }
    });
  }
}

function boundedPrepareAckTimeout(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_PREPARE_ACK_TIMEOUT_MS;
  return Math.min(Math.max(value, 1), MAX_PREPARE_ACK_TIMEOUT_MS);
}

async function removeIfPresent(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Another cleanup path may already have removed this session artifact.
  }
}

function requestIdFromUnknown(message: unknown): string {
  if (typeof message !== "object" || message === null) return "";
  const requestId = Reflect.get(message, "requestId");
  return typeof requestId === "string" && requestId.length > 0 && requestId.length <= 128
    ? requestId
    : "";
}

function protocolMismatchResponse(requestId: string) {
  return localBridgeErrorResponseSchema.parse({
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type: "error",
    requestId,
    error: {
      code: "protocol-mismatch",
      message: "The Chrome extension returned an incompatible local bridge response.",
    },
  });
}

function dispatchFailedResponse(requestId: string, message: string) {
  return localBridgeErrorResponseSchema.parse({
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type: "error",
    requestId,
    error: { code: "dispatch-failed", message },
  });
}

function nativeMessageFrame(message: unknown): Buffer | undefined {
  const encoded = Buffer.from(JSON.stringify(message), "utf8");
  if (encoded.length > MAX_NATIVE_MESSAGE_BYTES) return undefined;
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32LE(encoded.length, 0);
  return Buffer.concat([prefix, encoded]);
}

async function* nativeMessageStream(stream: NodeJS.ReadableStream): AsyncGenerator<unknown> {
  let buffer = Buffer.alloc(0);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0);
      if (length > 64 * 1024 * 1024) throw new Error("Native message exceeds Chrome's size limit.");
      if (buffer.length < 4 + length) break;
      const message = buffer.subarray(4, 4 + length).toString("utf8");
      buffer = buffer.subarray(4 + length);
      try {
        yield JSON.parse(message);
      } catch {
        // Native input is untrusted; malformed frames are discarded rather than
        // terminating the host process.
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await new NativeHost().run();
}
