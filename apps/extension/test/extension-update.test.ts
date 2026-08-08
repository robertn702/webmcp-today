import { describe, expect, it } from "vitest";
import {
  EXTENSION_UPDATE_KEY,
  SELF_HOSTED_RELEASE_ID,
  compareChromeVersions,
  parseChromeVersion,
  pollExtensionUpdate,
  readExtensionUpdateState,
  shouldShowExtensionUpdate,
} from "../src/lib/extension-update.js";
import { createFakeStorageArea } from "./fake-storage-area.js";

const ORIGIN = "https://registry.test";
const NOW = new Date("2026-08-05T12:00:00.000Z");

const latest = {
  channel: "stable" as const,
  version: "1.0.3",
  releaseUrl: "https://github.com/robertn702/webmcp-today/releases/tag/extension-v1.0.3",
  downloadUrl:
    "https://github.com/robertn702/webmcp-today/releases/download/extension-v1.0.3/webmcp-today-extension-1.0.3.zip",
  checksumsUrl:
    "https://github.com/robertn702/webmcp-today/releases/download/extension-v1.0.3/SHA256SUMS",
  publishedAt: "2026-08-05T11:00:00.000Z",
};

function pollDeps(area = createFakeStorageArea(), response: unknown = latest) {
  const calls: string[] = [];
  return {
    area,
    calls,
    fetchFn: async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify(response), { status: 200 });
    },
    origin: ORIGIN,
    getInstall: async () => ({ id: SELF_HOSTED_RELEASE_ID, installType: "development" }),
    now: () => NOW,
  };
}

describe("Chrome extension versions", () => {
  it("accepts Chrome versions and compares missing components as zero", () => {
    expect(parseChromeVersion("1")).toEqual([1]);
    expect(parseChromeVersion("1.2.3.4")).toEqual([1, 2, 3, 4]);
    expect(compareChromeVersions("1.0.10", "1.0.2")).toBeGreaterThan(0);
    expect(compareChromeVersions("1.1", "1.1.0")).toBe(0);
    expect(compareChromeVersions("1.2", "1.1.9.9999")).toBeGreaterThan(0);
  });

  it.each(["", "01.2", "1.02", "-1.0", "65536", "1.2.3.4.5", "1.0.0-beta"])(
    "rejects %s",
    (version) => {
      expect(parseChromeVersion(version)).toBeUndefined();
    },
  );
});

describe("pollExtensionUpdate", () => {
  it("persists validated metadata and reuses it after a worker restart", async () => {
    const deps = pollDeps();
    await expect(pollExtensionUpdate(deps)).resolves.toMatchObject({ latest });
    expect(deps.calls).toEqual([`${ORIGIN}/api/extension/latest`]);

    const restarted = pollDeps(deps.area);
    await expect(pollExtensionUpdate(restarted)).resolves.toMatchObject({ latest });
    expect(restarted.calls).toEqual([]);
  });

  it("shares concurrent stale checks", async () => {
    const deps = pollDeps();
    await Promise.all([pollExtensionUpdate(deps), pollExtensionUpdate(deps)]);
    expect(deps.calls).toEqual([`${ORIGIN}/api/extension/latest`]);
  });

  it("keeps the last valid state on malformed and failed responses", async () => {
    const area = createFakeStorageArea({
      [EXTENSION_UPDATE_KEY]: { checkedAt: "2026-08-03T12:00:00.000Z", latest },
    });
    const malformed = pollDeps(area, { version: "not valid" });
    await pollExtensionUpdate(malformed);
    expect(await readExtensionUpdateState(area)).toMatchObject({ latest });

    const failed = pollDeps(area);
    failed.fetchFn = async () => {
      throw new Error("offline");
    };
    await pollExtensionUpdate(failed);
    expect(await readExtensionUpdateState(area)).toMatchObject({ latest });
  });

  it("only exposes a newer update to the self-hosted unpacked release", () => {
    const state = { checkedAt: NOW.toISOString(), latest };
    expect(
      shouldShowExtensionUpdate(state, "1.0.2", {
        id: SELF_HOSTED_RELEASE_ID,
        installType: "development",
      }),
    ).toBe(true);
    expect(
      shouldShowExtensionUpdate(state, "1.0.3", {
        id: SELF_HOSTED_RELEASE_ID,
        installType: "development",
      }),
    ).toBe(false);
    expect(
      shouldShowExtensionUpdate(state, "1.0.4", {
        id: SELF_HOSTED_RELEASE_ID,
        installType: "development",
      }),
    ).toBe(false);
    expect(
      shouldShowExtensionUpdate(state, "1.0.2", { id: "dev-id", installType: "development" }),
    ).toBe(false);
    expect(
      shouldShowExtensionUpdate(state, "1.0.2", {
        id: SELF_HOSTED_RELEASE_ID,
        installType: "normal",
      }),
    ).toBe(false);
  });

  it.each([
    ["normal", { id: SELF_HOSTED_RELEASE_ID, installType: "normal" }],
    ["managed", { id: SELF_HOSTED_RELEASE_ID, installType: "admin" }],
    ["development key", { id: "development-extension-id", installType: "development" }],
  ])("does not request metadata for a %s install", async (_name, install) => {
    const deps = pollDeps();
    deps.getInstall = async () => install;

    await pollExtensionUpdate(deps);

    expect(deps.calls).toEqual([]);
  });

  it("does not request metadata when installation lookup fails", async () => {
    const deps = pollDeps();
    deps.getInstall = async () => {
      throw new Error("management unavailable");
    };

    await pollExtensionUpdate(deps);

    expect(deps.calls).toEqual([]);
  });
});
