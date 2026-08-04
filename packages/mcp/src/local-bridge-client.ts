import {
  LOCAL_BRIDGE_PROTOCOL_VERSION,
  localBridgeConfigurationSchema,
  localBridgeErrorResponseSchema,
  localBridgeRequestSchema,
  localBridgeResponseSchema,
  localBridgeSocketAcceptedSchema,
  localBridgeSocketDispatchAckSchema,
  localBridgeSocketDispatchingSchema,
  localBridgeSocketHelloSchema,
  type LocalBridgeRequest,
  type LocalBridgeResponse,
} from "@webmcp-today/schema";
import { connect, type Socket } from "node:net";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_CONFIGURATION_PATH = join(homedir(), ".config", "webmcp-today", "bridge.json");
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const MAX_REQUEST_TIMEOUT_MS = 60_000;

export interface LocalBridgeClientDeps {
  connectSocket: (path: string) => Socket;
  readConfiguration: (path: string) => Promise<unknown>;
  /** Testable transport setting; runtime requests are capped at one minute. */
  requestTimeoutMs?: number;
}

export class LocalBridgeClient {
  constructor(
    private readonly configurationPath = process.env.WEBMCP_TODAY_BRIDGE_CONFIG ??
      DEFAULT_CONFIGURATION_PATH,
    private readonly deps: LocalBridgeClientDeps = {
      connectSocket: (path) => connect(path),
      readConfiguration: async (path) => JSON.parse(await readFile(path, "utf8")),
    },
  ) {}

  async request(request: LocalBridgeRequest): Promise<LocalBridgeResponse> {
    const validRequest = localBridgeRequestSchema.parse(request);
    let configuration: unknown;
    try {
      configuration = await this.deps.readConfiguration(this.configurationPath);
    } catch {
      return unavailableResponse(
        validRequest.requestId,
        "The local WebMCP bridge is not configured.",
      );
    }
    const parsedConfiguration = localBridgeConfigurationSchema.safeParse(configuration);
    if (!parsedConfiguration.success) {
      return unavailableResponse(
        validRequest.requestId,
        "The local WebMCP bridge configuration is invalid.",
      );
    }

    try {
      return await requestOverSocket(validRequest, parsedConfiguration.data, this.deps);
    } catch {
      return unavailableResponse(
        validRequest.requestId,
        "The local WebMCP bridge is not connected to Chrome.",
      );
    }
  }
}

async function requestOverSocket(
  request: LocalBridgeRequest,
  configuration: { socketPath: string; secret: string },
  deps: LocalBridgeClientDeps,
): Promise<LocalBridgeResponse> {
  return new Promise<LocalBridgeResponse>((resolve, reject) => {
    const socket = deps.connectSocket(configuration.socketPath);
    let buffer = "";
    let accepted = false;
    let dispatching = false;
    let settled = false;
    const timeoutMs = boundedTimeout(deps.requestTimeoutMs);

    const detach = () => {
      socket.off("connect", onConnect);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("end", onEnd);
      socket.off("close", onClose);
    };
    const destroy = () => {
      if (!socket.destroyed) socket.destroy();
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      detach();
      destroy();
      reject(new Error(message));
    };
    const succeed = (response: LocalBridgeResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      detach();
      destroy();
      resolve(response);
    };
    const onConnect = () => {
      try {
        writeLine(
          socket,
          localBridgeSocketHelloSchema.parse({
            v: LOCAL_BRIDGE_PROTOCOL_VERSION,
            type: "socket-hello",
            role: "mcp-server",
            secret: configuration.secret,
          }),
        );
      } catch {
        fail("Unable to start the local bridge socket handshake.");
      }
    };
    const onData = (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) continue;
        let value: unknown;
        try {
          value = JSON.parse(line);
        } catch {
          if (accepted) {
            succeed(malformedResponse(request.requestId, dispatching, request.type));
            return;
          }
          fail("Invalid local bridge socket response.");
          return;
        }
        if (!accepted) {
          if (!localBridgeSocketAcceptedSchema.safeParse(value).success) {
            fail("Local bridge refused the native host handshake.");
            return;
          }
          accepted = true;
          try {
            writeLine(socket, request);
          } catch {
            fail("Unable to send the local bridge request.");
          }
          continue;
        }
        const dispatchingMessage = localBridgeSocketDispatchingSchema.safeParse(value);
        if (dispatchingMessage.success) {
          if (
            request.type !== "execute-tool" ||
            dispatching ||
            dispatchingMessage.data.requestId !== request.requestId
          ) {
            succeed(malformedResponse(request.requestId, dispatching, request.type));
            return;
          }
          // Once this is set, loss after writing the acknowledgement is conservatively
          // non-retry-safe even if the acknowledgement races with a local failure.
          dispatching = true;
          try {
            writeLine(
              socket,
              localBridgeSocketDispatchAckSchema.parse({
                v: LOCAL_BRIDGE_PROTOCOL_VERSION,
                type: "dispatch-ack",
                requestId: request.requestId,
              }),
            );
          } catch {
            succeed(executionTimeoutResponse(request.requestId));
            return;
          }
          continue;
        }
        const response = localBridgeResponseSchema.safeParse(value);
        if (!response.success || response.data.requestId !== request.requestId) {
          succeed(malformedResponse(request.requestId, dispatching, request.type));
          return;
        }
        if (
          dispatching &&
          request.type === "execute-tool" &&
          response.data.type === "error" &&
          (response.data.error.code === "bridge-unavailable" ||
            response.data.error.code === "protocol-mismatch")
        ) {
          succeed(executionTimeoutResponse(request.requestId));
          return;
        }
        succeed(response.data);
      }
    };
    const onError = () => {
      if (dispatching && request.type === "execute-tool") {
        succeed(executionTimeoutResponse(request.requestId));
        return;
      }
      fail("The local bridge socket failed.");
    };
    const onEnd = () => {
      if (dispatching && request.type === "execute-tool") {
        succeed(executionTimeoutResponse(request.requestId));
        return;
      }
      fail(
        accepted
          ? "The local bridge socket ended before responding."
          : "The local bridge socket ended before completing its handshake.",
      );
    };
    const onClose = () => {
      if (dispatching && request.type === "execute-tool") {
        succeed(executionTimeoutResponse(request.requestId));
        return;
      }
      fail(
        accepted
          ? "The local bridge socket closed before responding."
          : "The local bridge socket closed before completing its handshake.",
      );
    };
    const timeout = setTimeout(() => {
      if (dispatching && request.type === "execute-tool") {
        // The marker precedes the Chrome write, so stopping our socket wait cannot
        // establish that the browser-side tool did not run.
        succeed(executionTimeoutResponse(request.requestId));
        return;
      }
      fail("The local bridge socket timed out.");
    }, timeoutMs);

    socket.setEncoding("utf8");
    socket.on("connect", onConnect);
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("end", onEnd);
    socket.on("close", onClose);
  });
}

function boundedTimeout(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_REQUEST_TIMEOUT_MS;
  return Math.min(Math.max(value, 1), MAX_REQUEST_TIMEOUT_MS);
}

function writeLine(socket: Socket, value: unknown): void {
  socket.write(`${JSON.stringify(value)}\n`);
}

function unavailableResponse(requestId: string, message: string): LocalBridgeResponse {
  return localBridgeErrorResponseSchema.parse({
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type: "error",
    requestId,
    error: { code: "bridge-unavailable", message },
  });
}

function protocolMismatchResponse(requestId: string, message: string): LocalBridgeResponse {
  return localBridgeErrorResponseSchema.parse({
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type: "error",
    requestId,
    error: { code: "protocol-mismatch", message },
  });
}

function malformedResponse(
  requestId: string,
  dispatching: boolean,
  requestType: LocalBridgeRequest["type"],
): LocalBridgeResponse {
  if (dispatching && requestType === "execute-tool") {
    return executionTimeoutResponse(requestId);
  }
  return protocolMismatchResponse(
    requestId,
    "The local bridge returned an incompatible response. Update the extension and MCP server.",
  );
}

function executionTimeoutResponse(requestId: string): LocalBridgeResponse {
  return localBridgeErrorResponseSchema.parse({
    v: LOCAL_BRIDGE_PROTOCOL_VERSION,
    type: "error",
    requestId,
    error: {
      code: "execution-timeout",
      message:
        "The local bridge stopped waiting for Chrome after preparing the tool call for dispatch. It may still have executed - verify its effect before retrying.",
    },
  });
}
