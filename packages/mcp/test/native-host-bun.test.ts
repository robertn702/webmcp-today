import { spawn, spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { connect, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { LOCAL_BRIDGE_PROTOCOL_VERSION } from "@webmcp-today/schema";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function nativeMessage(stream: NodeJS.ReadableStream): Promise<unknown> {
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

function openSocket(path: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(path);
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function writeNativeFrame(stream: NodeJS.WritableStream, message: unknown): void {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32LE(payload.length, 0);
  stream.write(Buffer.concat([prefix, payload]));
}

describe("native host under Bun", () => {
  it("relays a socket request and response", { timeout: 15_000 }, async () => {
    if (spawnSync("bun", ["--version"], { stdio: "ignore" }).status !== 0) return;

    const homeDirectory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-bun-"));
    temporaryDirectories.push(homeDirectory);
    const standalonePath = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "dist",
      "native-host.standalone.js",
    );
    try {
      await access(standalonePath);
    } catch {
      throw new Error(`Built standalone native host is missing: ${standalonePath}`);
    }

    const host = spawn("bun", [standalonePath], {
      stdio: ["pipe", "pipe", "inherit"],
      env: { ...process.env, HOME: homeDirectory },
    });
    if (!host.stdin || !host.stdout) throw new Error("Bun native host did not expose stdio.");

    const ready = nativeMessage(host.stdout);
    await expect(ready).resolves.toMatchObject({ type: "bridge-ready" });
    const configuration = JSON.parse(
      await readFile(join(homeDirectory, ".config", "webmcp-today", "bridge.json"), "utf8"),
    );
    expect(configuration).toMatchObject({
      socketPath: expect.any(String),
      secret: expect.any(String),
    });

    const socket = await openSocket(configuration.socketPath);
    const accepted = socketMessage(socket);
    socket.write(
      `${JSON.stringify({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "socket-hello",
        role: "mcp-server",
        secret: configuration.secret,
      })}\n`,
    );
    await expect(accepted).resolves.toMatchObject({ type: "socket-accepted" });

    const request = nativeMessage(host.stdout);
    socket.write(
      `${JSON.stringify({
        v: LOCAL_BRIDGE_PROTOCOL_VERSION,
        type: "list-tabs",
        requestId: "bun-request",
      })}\n`,
    );
    await expect(request).resolves.toMatchObject({ type: "list-tabs", requestId: "bun-request" });

    const response = socketMessage(socket);
    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    writeNativeFrame(host.stdin, {
      v: LOCAL_BRIDGE_PROTOCOL_VERSION,
      type: "tabs",
      requestId: "bun-request",
      tabs: [],
    });
    await expect(response).resolves.toMatchObject({
      type: "tabs",
      requestId: "bun-request",
      tabs: [],
    });
    await closed;

    const exited = new Promise<number | null>((resolve) =>
      host.once("exit", (code) => resolve(code)),
    );
    host.stdin.end();
    await expect(exited).resolves.toBe(0);
  });
});
