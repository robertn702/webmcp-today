import { describe, expect, it } from "vitest";
import { apiContentHash } from "@robertn702/webmcp-cafe-schema";
import { createInstallsStore, type InstallOptions } from "../src/lib/installs-store.js";
import { INDEX_KEY, SCHEMA_VERSION_KEY, pkgKey } from "../src/lib/store-schema.js";
import { createFakeStorageArea } from "./fake-storage-area.js";

const OPTS: InstallOptions = { source: "registry", origin: "https://webmcp.cafe" };

const API_BLOCK = {
  baseUrl: "https://en.wikipedia.org",
  endpoints: { summary: { method: "GET", path: "/api/rest_v1/page/summary" } },
};

/** A registry-served body, as install() receives it: plain parsed JSON. */
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
    tools: [
      {
        name: "wiki_summary",
        description: "wiki_summary fixture tool",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true },
        execution: {
          mode: "dom",
          selector: "body",
          autosubmit: false,
          resultSelector: "p",
          resultExtract: "text",
        },
      },
    ],
    ...overrides,
  };
}

describe("installs-store", () => {
  describe("install", () => {
    it("writes the body verbatim plus the index entry and schemaVersion", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);
      const body = servedPackage({ futureField: "kept" });

      const result = await store.install(body, OPTS);

      expect(result.ok).toBe(true);
      const snapshot = area.snapshot();
      expect(snapshot[SCHEMA_VERSION_KEY]).toBe(1);
      // Verbatim: unknown fields survive storage — zod's stripped output is
      // never what lands on disk.
      expect(snapshot[pkgKey("pkg-wiki")]).toEqual(body);
      const index = await store.readIndex();
      expect(index["pkg-wiki"]).toMatchObject({
        packageId: "pkg-wiki",
        versionId: "ver-1",
        version: 1,
        domain: "en.wikipedia.org",
        title: "Wikipedia article",
        source: "registry",
        origin: "https://webmcp.cafe",
      });
      expect(await store.loadPackage("pkg-wiki")).toMatchObject({ status: "ok" });
    });

    it("upserts: reinstalling reports the replaced version and keeps one entry", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);
      await store.install(servedPackage(), OPTS);

      const result = await store.install(servedPackage({ versionId: "ver-2", version: 2 }), OPTS);

      expect(result).toMatchObject({ ok: true, replaced: { versionId: "ver-1", version: 1 } });
      const index = await store.readIndex();
      expect(Object.keys(index)).toEqual(["pkg-wiki"]);
      expect(index["pkg-wiki"]).toMatchObject({ versionId: "ver-2", version: 2 });
    });

    it("rejects a body that fails the package schema, writing nothing", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);

      const result = await store.install({ nonsense: true }, OPTS);

      expect(result).toEqual({ ok: false, reason: "invalid-body" });
      expect(area.snapshot()).toEqual({});
    });

    it("verifies apiContentHash by recomputation and carries it in the index", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);
      const goodHash = apiContentHash(API_BLOCK);

      const ok = await store.install(
        servedPackage({ api: API_BLOCK, apiContentHash: goodHash }),
        OPTS,
      );
      expect(ok.ok).toBe(true);
      const index = await store.readIndex();
      expect(index["pkg-wiki"]?.apiContentHash).toBe(goodHash);
    });

    it.each([
      [
        "a hash that does not match the api block",
        { api: API_BLOCK, apiContentHash: "f".repeat(64) },
      ],
      ["an api block without its hash", { api: API_BLOCK }],
      ["a hash without an api block", { apiContentHash: "f".repeat(64) }],
    ])("rejects %s, writing nothing", async (_label, overrides) => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);

      const result = await store.install(servedPackage(overrides), OPTS);

      expect(result).toEqual({ ok: false, reason: "hash-mismatch" });
      expect(area.snapshot()).toEqual({});
    });

    it("leaves NO partial state observable when the atomic set fails", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);
      area.failNextSet();

      await expect(store.install(servedPackage(), OPTS)).rejects.toThrow("set failed");

      // The multi-key set is all-or-nothing: no body without an index entry,
      // no index entry without a body, no schemaVersion from a failed install.
      expect(area.snapshot()).toEqual({});
      expect(await store.readIndex()).toEqual({});
      expect(await store.loadPackage("pkg-wiki")).toEqual({ status: "missing" });

      // And the write queue survives the rejection.
      const retry = await store.install(servedPackage(), OPTS);
      expect(retry.ok).toBe(true);
    });
  });

  describe("uninstall", () => {
    it("removes the entry and the body", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);
      await store.install(servedPackage(), OPTS);

      expect(await store.uninstall("pkg-wiki")).toEqual({ ok: true });
      expect(await store.readIndex()).toEqual({});
      expect(await store.loadPackage("pkg-wiki")).toEqual({ status: "missing" });
    });

    it("reports not-installed for an unknown package", async () => {
      const store = createInstallsStore(createFakeStorageArea());
      expect(await store.uninstall("nope")).toEqual({ ok: false, reason: "not-installed" });
    });

    it("orphans the body when interrupted after the index write, and GC reclaims it", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);
      await store.install(servedPackage(), OPTS);
      await store.install(servedPackage({ id: "pkg-other" }), OPTS);

      // Crash between the two uninstall calls: index updated, body left behind.
      area.failNextRemove();
      await expect(store.uninstall("pkg-wiki")).rejects.toThrow("remove failed");

      // The orphan is invisible to the index-driven read path...
      expect(Object.keys(await store.readIndex())).toEqual(["pkg-other"]);
      // ...but still on disk, until startup GC reclaims exactly it.
      expect(area.snapshot()[pkgKey("pkg-wiki")]).toBeDefined();
      expect(await store.collectOrphans()).toEqual([pkgKey("pkg-wiki")]);
      expect(area.snapshot()[pkgKey("pkg-wiki")]).toBeUndefined();
      expect(area.snapshot()[pkgKey("pkg-other")]).toBeDefined();
    });
  });

  describe("startup", () => {
    it("initialize writes schemaVersion on first run and collects orphans", async () => {
      const area = createFakeStorageArea({ [pkgKey("ghost")]: servedPackage({ id: "ghost" }) });
      const store = createInstallsStore(area);

      expect(await store.initialize()).toBe("ok");

      const snapshot = area.snapshot();
      expect(snapshot[SCHEMA_VERSION_KEY]).toBe(1);
      expect(snapshot[pkgKey("ghost")]).toBeUndefined();
    });

    it("skips GC when the index is present but corrupt", async () => {
      const area = createFakeStorageArea({
        [INDEX_KEY]: { "pkg-wiki": { broken: true } },
        [pkgKey("pkg-wiki")]: servedPackage(),
      });
      const store = createInstallsStore(area);

      expect(await store.collectOrphans()).toEqual([]);
      expect(area.snapshot()[pkgKey("pkg-wiki")]).toBeDefined();
      expect(await store.readIndex()).toEqual({});
    });
  });

  describe("schemaVersion guard", () => {
    it("treats storage written by a newer build as unreadable and untouchable", async () => {
      const seed = {
        [SCHEMA_VERSION_KEY]: 2,
        [pkgKey("future")]: { shape: "unknowable" },
      };
      const area = createFakeStorageArea(seed);
      const store = createInstallsStore(area);

      expect(await store.readSchemaVersionState()).toBe("newer");
      expect(await store.initialize()).toBe("newer");
      expect(await store.install(servedPackage(), OPTS)).toEqual({
        ok: false,
        reason: "schema-unreadable",
      });
      expect(await store.uninstall("future")).toEqual({
        ok: false,
        reason: "schema-unreadable",
      });
      // Nothing was written, downgraded, or GC'd.
      expect(area.snapshot()).toEqual(seed);
    });

    it("flags a non-integer schemaVersion as corrupt", async () => {
      const store = createInstallsStore(createFakeStorageArea({ [SCHEMA_VERSION_KEY]: "one" }));
      expect(await store.readSchemaVersionState()).toBe("corrupt");
    });

    it("reads ok on first run and at the current version", async () => {
      expect(await createInstallsStore(createFakeStorageArea()).readSchemaVersionState()).toBe(
        "ok",
      );
      expect(
        await createInstallsStore(
          createFakeStorageArea({ [SCHEMA_VERSION_KEY]: 1 }),
        ).readSchemaVersionState(),
      ).toBe("ok");
    });
  });

  describe("write queue", () => {
    it("serializes concurrent installs so neither index entry is lost", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);

      // Fired without awaiting: unserialized, both would read the empty index
      // and the later set() would drop the earlier entry.
      const [a, b] = await Promise.all([
        store.install(servedPackage({ id: "pkg-a" }), OPTS),
        store.install(servedPackage({ id: "pkg-b" }), OPTS),
      ]);

      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      expect(Object.keys(await store.readIndex()).sort()).toEqual(["pkg-a", "pkg-b"]);
    });

    it("serializes installs against uninstalls", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);
      await store.install(servedPackage({ id: "pkg-a" }), OPTS);

      const [installed, uninstalled] = await Promise.all([
        store.install(servedPackage({ id: "pkg-b" }), OPTS),
        store.uninstall("pkg-a"),
      ]);

      expect(installed.ok).toBe(true);
      expect(uninstalled).toEqual({ ok: true });
      expect(Object.keys(await store.readIndex())).toEqual(["pkg-b"]);
    });
  });
});
