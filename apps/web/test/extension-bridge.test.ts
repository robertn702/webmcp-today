import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The bridge reads globalThis.chrome (absent in node) and the env-var ID
// list; both are stubbed per test. env.ts validates at import and no other
// web test imports it, so the required server vars are stubbed here too.

type SendMessage = WebMcpTodayChromeRuntime["sendMessage"];

const PING_OK = {
  ok: true,
  protocol: 1,
  engine: 1,
  extensionVersion: "0.0.1",
  storageReadable: true,
};

const typeProbe = z.object({ type: z.string() });

function installChrome(sendMessage: SendMessage): void {
  globalThis.chrome = { runtime: { sendMessage } };
}

/** Answers with `responses[message.type]` when the message goes to
 *  `winnerId`; anything else fires lastError like Chrome does for an unknown
 *  ID. Sets lastError per call on the SAME runtime object — the bridge reads
 *  it from the reference it captured, so replacing globalThis.chrome would
 *  be invisible. */
function chromeRouter(winnerId: string, responses: Record<string, unknown>): SendMessage {
  return (extensionId, message, callback) => {
    const runtime = globalThis.chrome?.runtime;
    const won = extensionId === winnerId;
    if (runtime !== undefined) {
      runtime.lastError = won ? undefined : { message: "Could not establish connection" };
    }
    const parsed = typeProbe.safeParse(message);
    callback(won && parsed.success ? responses[parsed.data.type] : undefined);
  };
}

async function loadBridge(ids?: string) {
  vi.stubEnv("DATABASE_URL", "postgres://localhost:5432/test");
  vi.stubEnv("GITHUB_CLIENT_ID", "test");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "test");
  vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
  if (ids !== undefined) vi.stubEnv("NEXT_PUBLIC_WEBMCP_EXTENSION_IDS", ids);
  return import("@/lib/extension-bridge");
}

describe("extension-bridge", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.chrome = undefined;
    vi.unstubAllEnvs();
  });

  it("reports absent when no extension IDs are configured", async () => {
    const bridge = await loadBridge("");
    installChrome(vi.fn());

    expect(await bridge.pingExtension()).toEqual({ status: "absent" });
  });

  it("reports absent when window.chrome.runtime does not exist", async () => {
    const bridge = await loadBridge("id-a,id-b");

    expect(await bridge.pingExtension()).toEqual({ status: "absent" });
  });

  it("re-probes after an absent result when a user rechecks after loading the extension", async () => {
    const bridge = await loadBridge("id-a");
    installChrome(vi.fn(chromeRouter("no-extension", {})));

    expect(await bridge.pingExtension()).toEqual({ status: "absent" });

    installChrome(chromeRouter("id-a", { ping: PING_OK }));
    bridge.resetExtensionBridgeProbe();

    expect(await bridge.pingExtension()).toEqual({ status: "ok", data: PING_OK });
  });

  it("probes the configured IDs in order and caches the winner", async () => {
    const bridge = await loadBridge("id-a, id-b");
    const sendMessage = vi.fn(chromeRouter("id-b", { ping: PING_OK }));
    installChrome(sendMessage);

    const result = await bridge.pingExtension();

    expect(result).toEqual({ status: "ok", data: PING_OK });
    // id-a (refused), id-b (probe ping), id-b again (the call itself).
    expect(sendMessage.mock.calls.map((callArgs) => callArgs[0])).toEqual(["id-a", "id-b", "id-b"]);

    // A later call goes straight to the cached winner — no re-probe.
    const listSender = vi.fn(chromeRouter("id-b", { "list-installs": { ok: true, installs: [] } }));
    installChrome(listSender);
    await bridge.listInstalls();
    expect(listSender.mock.calls.map((callArgs) => callArgs[0])).toEqual(["id-b"]);
  });

  it("reports absent when every ID times out", async () => {
    vi.useFakeTimers();
    try {
      const bridge = await loadBridge("id-a");
      installChrome(() => {
        // Never calls back — the bridge's own timeout must fire.
      });

      const pending = bridge.pingExtension();
      await vi.advanceTimersByTimeAsync(2000);

      expect(await pending).toEqual({ status: "absent" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a malformed ping response and keeps probing", async () => {
    const bridge = await loadBridge("id-a,id-b");
    installChrome((extensionId, message, callback) => {
      callback(extensionId === "id-a" ? { hello: "world" } : PING_OK);
    });

    const result = await bridge.pingExtension();

    expect(result).toEqual({ status: "ok", data: PING_OK });
  });

  it("reports invalid when a call response fails the protocol schema", async () => {
    const bridge = await loadBridge("id-a");
    installChrome(
      chromeRouter("id-a", {
        ping: PING_OK,
        "list-installs": { ok: false, reason: "not-a-real-reason" },
      }),
    );

    expect(await bridge.listInstalls()).toEqual({ status: "invalid" });
  });

  it("sends the install message with the pinned versionId and returns the response", async () => {
    const bridge = await loadBridge("id-a");
    const installResponse = { ok: true, packageId: "pkg-1", versionId: "ver-2", version: 2 };
    const sendMessage = vi.fn(chromeRouter("id-a", { ping: PING_OK, install: installResponse }));
    installChrome(sendMessage);

    const result = await bridge.installPackage("pkg-1", "ver-2");

    expect(result).toEqual({ status: "ok", data: installResponse });
    const installCall = sendMessage.mock.calls.at(-1);
    expect(installCall?.[1]).toEqual({
      v: 1,
      type: "install",
      packageId: "pkg-1",
      versionId: "ver-2",
    });
  });

  it("re-probes when the cached winner stops answering", async () => {
    const bridge = await loadBridge("id-a");
    installChrome(chromeRouter("id-a", { ping: PING_OK }));
    await bridge.pingExtension();

    // Extension "uninstalled": every send now errors.
    installChrome((_id, _message, callback) => {
      const runtime = globalThis.chrome?.runtime;
      if (runtime !== undefined) {
        runtime.lastError = { message: "Extension context invalidated" };
      }
      callback(undefined);
    });

    expect(await bridge.pingExtension()).toEqual({ status: "absent" });
  });
});
