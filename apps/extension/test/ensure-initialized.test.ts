import { describe, expect, it } from "vitest";
import { createEnsureInitialized } from "../src/lib/ensure-initialized.js";
import { createInstallsStore, type InstallOptions } from "../src/lib/installs-store.js";
import { INDEX_KEY, SCHEMA_VERSION_KEY, pkgKey } from "../src/lib/store-schema.js";
import { createFakeStorageArea } from "./fake-storage-area.js";

// createEnsureInitialized() is the memoization background.ts wraps store.initialize()
// in — extracted to its own module so it's testable without wxt/browser. These tests
// prove the gate that lets a first lookup/bridge call "arrive while a reset is in
// flight": concurrent callers share one initialize() call and only ever observe its
// settled (post-reset) result.

const OPTS: InstallOptions = { source: "registry", origin: "https://webmcp.today" };

const API_BLOCK = {
  baseUrl: "https://en.wikipedia.org",
  endpoints: { summary: { method: "GET", path: "/api/rest_v1/page/summary" } },
};

function servedPackage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "pkg-wiki",
    versionId: "ver-1",
    version: 1,
    domain: "en.wikipedia.org",
    urlPatterns: ["*://en.wikipedia.org/wiki/*"],
    title: "Wikipedia article",
    description: "Fixture package",
    contributor: "robert",
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
    minEngine: 1,
    tools: [
      {
        name: "wiki_summary",
        description: "wiki_summary fixture tool",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execution: { mode: "api", endpoint: "summary" },
      },
    ],
    api: API_BLOCK,
    ...overrides,
  };
}

function seedV1(): Record<string, unknown> {
  return {
    [SCHEMA_VERSION_KEY]: 1,
    [INDEX_KEY]: {
      "pkg-wiki": {
        packageId: "pkg-wiki",
        versionId: "ver-1",
        version: 1,
        domain: "en.wikipedia.org",
        urlPatterns: ["*://en.wikipedia.org/wiki/*"],
        title: "Wikipedia article",
        installedAt: "2026-07-27T00:00:00.000Z",
        source: "registry",
        origin: "https://webmcp.today",
      },
    },
    [pkgKey("pkg-wiki")]: servedPackage(),
  };
}

describe("createEnsureInitialized", () => {
  it("memoizes concurrent callers into one initialize() call, and both see the reset v2 storage", async () => {
    const area = createFakeStorageArea(seedV1());
    const store = createInstallsStore(area);
    let calls = 0;
    const trackedStore = {
      ...store,
      initialize: () => {
        calls += 1;
        return store.initialize();
      },
    };
    const ensureInitialized = createEnsureInitialized(trackedStore);

    // Both "arrive" before either settles — e.g. a lookup and a bridge ping
    // racing the very first worker wake.
    const [first, second] = await Promise.all([ensureInitialized(), ensureInitialized()]);

    expect(calls).toBe(1);
    expect(first).toBe("ok");
    expect(second).toBe("ok");
    expect(await store.readIndex()).toEqual({});
    expect(area.snapshot()[pkgKey("pkg-wiki")]).toBeUndefined();
    expect(area.snapshot()[SCHEMA_VERSION_KEY]).toBe(2);
  });

  it("a caller arriving after initialize() has started but before it settles waits for the same in-flight reset", async () => {
    const area = createFakeStorageArea(seedV1());
    const store = createInstallsStore(area);
    const ensureInitialized = createEnsureInitialized(store);

    const first = ensureInitialized();
    // Let the first call's enqueue() task start, but not finish — the fake
    // storage area yields a microtask per get/set/remove call.
    await Promise.resolve();
    const second = ensureInitialized();

    expect(await first).toBe("ok");
    expect(await second).toBe("ok");
    expect(await store.readIndex()).toEqual({});
    expect(area.snapshot()[pkgKey("pkg-wiki")]).toBeUndefined();
  });

  it("clears the memo on rejection so the next call invokes initialize() again", async () => {
    const area = createFakeStorageArea(seedV1());
    const store = createInstallsStore(area);
    area.failNextRemove(); // makes the reset's body removal throw.
    let calls = 0;
    const trackedStore = {
      ...store,
      initialize: () => {
        calls += 1;
        return store.initialize();
      },
    };
    const ensureInitialized = createEnsureInitialized(trackedStore);

    await expect(ensureInitialized()).rejects.toThrow("remove failed");
    expect(calls).toBe(1);
    // Nothing was reset by the failed attempt.
    expect(area.snapshot()[SCHEMA_VERSION_KEY]).toBe(1);
    expect(area.snapshot()[pkgKey("pkg-wiki")]).toBeDefined();

    // The retry is a genuinely new initialize() call, not a cached rejection.
    const retried = await ensureInitialized();
    expect(retried).toBe("ok");
    expect(calls).toBe(2);
    expect(area.snapshot()[SCHEMA_VERSION_KEY]).toBe(2);
    expect(area.snapshot()[pkgKey("pkg-wiki")]).toBeUndefined();
  });

  it("a concurrent caller sharing a since-rejected in-flight promise also rejects, then the next call retries", async () => {
    const area = createFakeStorageArea(seedV1());
    const store = createInstallsStore(area);
    area.failNextRemove();
    const ensureInitialized = createEnsureInitialized(store);

    const first = ensureInitialized();
    const second = ensureInitialized(); // shares the same in-flight promise

    await expect(first).rejects.toThrow("remove failed");
    await expect(second).rejects.toThrow("remove failed");

    const retried = await ensureInitialized();
    expect(retried).toBe("ok");
    expect(await store.install(servedPackage({ id: "pkg-fresh" }), OPTS)).toMatchObject({
      ok: true,
    });
  });
});
