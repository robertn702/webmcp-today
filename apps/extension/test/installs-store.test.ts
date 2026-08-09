import { describe, expect, it } from "vitest";
import {
  createInstallsStore,
  type InstallOptions,
  type InstallResult,
} from "../src/lib/installs-store.js";
import {
  DOMAINS_KEY,
  INDEX_KEY,
  REVOKED_KEY,
  SCHEMA_VERSION_KEY,
  STORAGE_SCHEMA_VERSION,
  pkgKey,
} from "../src/lib/store-schema.js";
import { EXTENSION_UPDATE_KEY } from "../src/lib/extension-update.js";
import { matchInstalled } from "../src/lib/match-installed.js";
import { createFakeStorageArea } from "./fake-storage-area.js";

const OPTS: InstallOptions = { source: "registry", origin: "https://webmcp.today" };

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

describe("installs-store", () => {
  describe("install", () => {
    it("writes the body verbatim plus the index entry and schemaVersion", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);
      const body = servedPackage({ futureField: "kept" });

      const result = await store.install(body, OPTS);

      expect(result.ok).toBe(true);
      const snapshot = area.snapshot();
      expect(snapshot[SCHEMA_VERSION_KEY]).toBe(2);
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
        origin: "https://webmcp.today",
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

    it("rejects a legacy body whose pattern exceeds its visible domain", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);

      const result = await store.install(servedPackage({ urlPatterns: ["*://*/*"] }), OPTS);

      expect(result).toEqual({ ok: false, reason: "invalid-body" });
      expect(area.snapshot()).toEqual({});
    });

    it("rejects a body without an api block (required field), writing nothing", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);

      const result = await store.install(servedPackage({ api: undefined }), OPTS);

      expect(result).toEqual({ ok: false, reason: "invalid-body" });
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

    it("performs exactly one set() call for install — body, index, and schemaVersion together", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);

      const result = await store.install(servedPackage(), OPTS);

      expect(result.ok).toBe(true);
      expect(area.setCalls()).toHaveLength(1);
      expect(area.setCalls()[0]?.sort()).toEqual(
        [SCHEMA_VERSION_KEY, pkgKey("pkg-wiki"), INDEX_KEY].sort(),
      );
    });

    it("pins the crash window a split write would open: failing set() call #2 must never orphan a body", async () => {
      const area = createFakeStorageArea();
      const store = createInstallsStore(area);
      // Targets the SECOND set() call specifically — failNextSet() only ever
      // fails the first call, so it can't distinguish "one atomic set" from a
      // regressed "set(body) then set(index)", where the first call would
      // land before the second one fails.
      area.failSetOnCall(2);

      let result: InstallResult | undefined;
      let rejected = false;
      try {
        result = await store.install(servedPackage(), OPTS);
      } catch {
        rejected = true;
      }

      if (rejected) {
        // Only reachable if install were split into two ordered set() calls:
        // the body's call landed, the index's call didn't. That orphan must
        // never be observable.
        expect(area.snapshot()[pkgKey("pkg-wiki")]).toBeUndefined();
        expect(await store.readIndex()).toEqual({});
      } else {
        // Today's contract: one set() call, so a failure on call #2 never
        // fires and the install fully succeeds.
        expect(result?.ok).toBe(true);
        expect(area.snapshot()[pkgKey("pkg-wiki")]).toBeDefined();
        expect((await store.readIndex())["pkg-wiki"]).toBeDefined();
      }
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

  describe("loadPackage", () => {
    it("treats a previously stored out-of-scope body as invalid", async () => {
      const area = createFakeStorageArea({
        [pkgKey("pkg-wiki")]: servedPackage({ urlPatterns: ["*://*/*"] }),
      });
      const store = createInstallsStore(area);

      expect(await store.loadPackage("pkg-wiki")).toEqual({ status: "invalid" });
    });
  });

  describe("startup", () => {
    it("initialize writes schemaVersion on first run and collects orphans", async () => {
      const area = createFakeStorageArea({ [pkgKey("ghost")]: servedPackage({ id: "ghost" }) });
      const store = createInstallsStore(area);

      expect(await store.initialize()).toBe("ok");

      const snapshot = area.snapshot();
      expect(snapshot[SCHEMA_VERSION_KEY]).toBe(2);
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
        [SCHEMA_VERSION_KEY]: 3,
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
      expect(await store.readIndex()).toEqual({});
      expect(await store.loadPackage("future")).toEqual({ status: "missing" });
      expect(await store.collectOrphans()).toEqual([]);
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
          createFakeStorageArea({ [SCHEMA_VERSION_KEY]: 2 }),
        ).readSchemaVersionState(),
      ).toBe("ok");
    });

    it("distinguishes a stored version older than the build's as its own state", async () => {
      expect(
        await createInstallsStore(
          createFakeStorageArea({ [SCHEMA_VERSION_KEY]: 1 }),
        ).readSchemaVersionState(),
      ).toBe("older");
    });

    it("treats storage written by a corrupt marker as unreadable and untouchable", async () => {
      const seed = {
        [SCHEMA_VERSION_KEY]: "one",
        [INDEX_KEY]: { "pkg-wiki": { packageId: "pkg-wiki" } },
        [pkgKey("pkg-wiki")]: servedPackage(),
      };
      const area = createFakeStorageArea(seed);
      const store = createInstallsStore(area);

      expect(await store.readSchemaVersionState()).toBe("corrupt");
      expect(await store.initialize()).toBe("corrupt");
      expect(await store.install(servedPackage({ id: "pkg-new" }), OPTS)).toEqual({
        ok: false,
        reason: "schema-unreadable",
      });
      expect(await store.uninstall("pkg-wiki")).toEqual({
        ok: false,
        reason: "schema-unreadable",
      });
      expect(await store.readIndex()).toEqual({});
      expect(await store.loadPackage("pkg-wiki")).toEqual({ status: "missing" });
      expect(await store.collectOrphans()).toEqual([]);
      // Nothing was written, wiped, or GC'd.
      expect(area.snapshot()).toEqual(seed);
    });
  });

  describe("fail-closed before initialize() resets an older version", () => {
    /** v1 storage: one installed package (body + index entry), never reset. */
    function seedV1Single(): Record<string, unknown> {
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

    it("install() on v1 storage refuses and stamps nothing, without calling initialize()", async () => {
      const seed = seedV1Single();
      const area = createFakeStorageArea(seed);
      const store = createInstallsStore(area);

      const result = await store.install(servedPackage({ id: "pkg-new" }), OPTS);

      expect(result).toEqual({ ok: false, reason: "schema-unreadable" });
      // No schemaVersion stamp, no new body, no index mutation.
      expect(area.snapshot()).toEqual(seed);
    });

    it("uninstall() on v1 storage refuses and removes nothing, without calling initialize()", async () => {
      const seed = seedV1Single();
      const area = createFakeStorageArea(seed);
      const store = createInstallsStore(area);

      const result = await store.uninstall("pkg-wiki");

      expect(result).toEqual({ ok: false, reason: "schema-unreadable" });
      expect(area.snapshot()).toEqual(seed);
    });

    it("readIndex() on v1 storage reads empty (fail closed) rather than the stale v1 entries, and writes nothing", async () => {
      const seed = seedV1Single();
      const area = createFakeStorageArea(seed);
      const store = createInstallsStore(area);

      expect(await store.readIndex()).toEqual({});
      expect(area.snapshot()).toEqual(seed);
    });

    it("loadPackage() on v1 storage reads missing (fail closed) rather than the stale v1 body, and writes nothing", async () => {
      const seed = seedV1Single();
      const area = createFakeStorageArea(seed);
      const store = createInstallsStore(area);

      expect(await store.loadPackage("pkg-wiki")).toEqual({ status: "missing" });
      expect(area.snapshot()).toEqual(seed);
    });

    it("collectOrphans() on v1 storage removes nothing rather than GC'ing the stale v1 body", async () => {
      const seed = seedV1Single();
      const area = createFakeStorageArea(seed);
      const store = createInstallsStore(area);

      expect(await store.collectOrphans()).toEqual([]);
      expect(area.snapshot()).toEqual(seed);
    });

    it("only initialize() advances an older version — direct reads/writes never do", async () => {
      const seed = seedV1Single();
      const area = createFakeStorageArea(seed);
      const store = createInstallsStore(area);

      // A battery of direct calls that must all fail closed without mutating.
      await store.readIndex();
      await store.loadPackage("pkg-wiki");
      await store.install(servedPackage({ id: "pkg-new" }), OPTS);
      await store.uninstall("pkg-wiki");
      await store.collectOrphans();
      expect(area.snapshot()).toEqual(seed);

      // Only initialize() resets it.
      expect(await store.initialize()).toBe("ok");
      expect(area.snapshot()[SCHEMA_VERSION_KEY]).toBe(2);
      expect(area.snapshot()[pkgKey("pkg-wiki")]).toBeUndefined();
    });
  });

  describe("legacy storage reset", () => {
    /** A v1 install: two installed packages (bodies + index entries), plus
     * the revocation and domains docs a real install would have bootstrapped. */
    function seedV1Storage(): Record<string, unknown> {
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
          "pkg-other": {
            packageId: "pkg-other",
            versionId: "ver-1",
            version: 1,
            domain: "example.com",
            urlPatterns: ["*://example.com/*"],
            title: "Example",
            installedAt: "2026-07-27T00:00:00.000Z",
            source: "registry",
            origin: "https://webmcp.today",
          },
        },
        [pkgKey("pkg-wiki")]: servedPackage(),
        [pkgKey("pkg-other")]: servedPackage({
          id: "pkg-other",
          domain: "example.com",
          urlPatterns: ["*://example.com/*"],
          api: { ...API_BLOCK, baseUrl: "https://example.com" },
        }),
        [REVOKED_KEY]: { cursor: 4, fetchedAt: "2026-07-27T00:00:00.000Z", entries: [] },
        [DOMAINS_KEY]: {
          version: 1,
          generatedAt: "2026-07-27T00:00:00.000Z",
          fetchedAt: "2026-07-27T00:00:00.000Z",
          domains: ["en.wikipedia.org"],
        },
        [EXTENSION_UPDATE_KEY]: {
          checkedAt: "2026-07-27T00:00:00.000Z",
          latest: {
            channel: "stable",
            version: "1.2.3",
            releaseUrl: "https://webmcp.today/release",
            downloadUrl: "https://webmcp.today/release.zip",
            checksumsUrl: "https://webmcp.today/release.sha256",
            publishedAt: "2026-07-27T00:00:00.000Z",
          },
        },
      };
    }

    it("wipes every pkg:* body and the index, bumps to v2, and preserves unrelated keys", async () => {
      const seed = seedV1Storage();
      const area = createFakeStorageArea(seed);
      const store = createInstallsStore(area);

      expect(await store.initialize()).toBe("ok");

      const snapshot = area.snapshot();
      expect(snapshot[SCHEMA_VERSION_KEY]).toBe(2);
      expect(snapshot[INDEX_KEY]).toEqual({});
      expect(await store.readIndex()).toEqual({});
      expect(snapshot[pkgKey("pkg-wiki")]).toBeUndefined();
      expect(snapshot[pkgKey("pkg-other")]).toBeUndefined();
      expect(await store.loadPackage("pkg-wiki")).toEqual({ status: "missing" });
      expect(await store.loadPackage("pkg-other")).toEqual({ status: "missing" });

      // Compatible, unrelated documents survive untouched.
      expect(snapshot[REVOKED_KEY]).toEqual(seed[REVOKED_KEY]);
      expect(snapshot[DOMAINS_KEY]).toEqual(seed[DOMAINS_KEY]);
      expect(snapshot[EXTENSION_UPDATE_KEY]).toEqual(seed[EXTENSION_UPDATE_KEY]);
    });

    it("registers nothing for a URL a v1 install used to match", async () => {
      const area = createFakeStorageArea(seedV1Storage());
      const store = createInstallsStore(area);

      await store.initialize();

      const index = await store.readIndex();
      expect(matchInstalled(index, "https://en.wikipedia.org/wiki/Coffee")).toEqual([]);
    });

    it("fresh v2 installs work normally after the reset", async () => {
      const area = createFakeStorageArea(seedV1Storage());
      const store = createInstallsStore(area);
      await store.initialize();

      const result = await store.install(servedPackage({ id: "pkg-fresh" }), OPTS);

      expect(result.ok).toBe(true);
      expect(Object.keys(await store.readIndex())).toEqual(["pkg-fresh"]);
      expect(await store.loadPackage("pkg-fresh")).toMatchObject({ status: "ok" });
    });

    it("leaves the version unbumped and nothing removed when the body removal fails", async () => {
      const seed = seedV1Storage();
      const area = createFakeStorageArea(seed);
      const store = createInstallsStore(area);
      area.failNextRemove();

      await expect(store.initialize()).rejects.toThrow("remove failed");

      // No partial reset: still readable as "older" next time, bodies intact.
      const snapshot = area.snapshot();
      expect(snapshot[SCHEMA_VERSION_KEY]).toBe(1);
      expect(snapshot[pkgKey("pkg-wiki")]).toBeDefined();
      expect(snapshot[pkgKey("pkg-other")]).toBeDefined();
      expect(snapshot[INDEX_KEY]).toEqual(seed[INDEX_KEY]);

      // Retrying completes the reset.
      expect(await store.initialize()).toBe("ok");
      const retried = area.snapshot();
      expect(retried[SCHEMA_VERSION_KEY]).toBe(2);
      expect(retried[pkgKey("pkg-wiki")]).toBeUndefined();
    });

    it("is idempotent when the version bump fails after bodies were already removed", async () => {
      const seed = seedV1Storage();
      const area = createFakeStorageArea(seed);
      const store = createInstallsStore(area);
      area.failNextSet();

      await expect(store.initialize()).rejects.toThrow("set failed");

      // Bodies gone, but the version marker never advanced — the next
      // initialize() must not choke on an already-empty removal.
      const mid = area.snapshot();
      expect(mid[SCHEMA_VERSION_KEY]).toBe(1);
      expect(mid[pkgKey("pkg-wiki")]).toBeUndefined();

      expect(await store.initialize()).toBe("ok");
      const final = area.snapshot();
      expect(final[SCHEMA_VERSION_KEY]).toBe(2);
      expect(final[INDEX_KEY]).toEqual({});
    });
  });

  describe("initialize() reset when no version was ever stamped and the index is corrupt", () => {
    it("wipes every pkg:* body (not just orphans) before stamping v2, preserving unrelated docs", async () => {
      const seed = {
        // No SCHEMA_VERSION_KEY at all — indistinguishable from true first run
        // except that the index is unparseable, so GC alone can't safely
        // compute orphans (collectOrphansInner skips deletion in that case).
        [INDEX_KEY]: { "pkg-wiki": { broken: true } },
        [pkgKey("pkg-wiki")]: servedPackage(),
        [REVOKED_KEY]: { cursor: 1, fetchedAt: "2026-07-27T00:00:00.000Z", entries: [] },
      };
      const area = createFakeStorageArea(seed);
      const store = createInstallsStore(area);

      expect(await store.initialize()).toBe("ok");

      const snapshot = area.snapshot();
      expect(snapshot[SCHEMA_VERSION_KEY]).toBe(2);
      expect(snapshot[INDEX_KEY]).toEqual({});
      expect(snapshot[pkgKey("pkg-wiki")]).toBeUndefined();
      expect(snapshot[REVOKED_KEY]).toEqual(seed[REVOKED_KEY]);
    });

    it("does NOT full-reset a corrupt index once a version is already stamped — GC's orphan-only skip still applies", async () => {
      const seed = {
        [SCHEMA_VERSION_KEY]: STORAGE_SCHEMA_VERSION,
        [INDEX_KEY]: { "pkg-wiki": { broken: true } },
        [pkgKey("pkg-wiki")]: servedPackage(),
      };
      const area = createFakeStorageArea(seed);
      const store = createInstallsStore(area);

      expect(await store.initialize()).toBe("ok");

      // Already at the current version: this is the popup's "index-corrupt"
      // recovery case, not a legacy reset — the body must survive so GC
      // doesn't misfire as "delete every body".
      expect(area.snapshot()[pkgKey("pkg-wiki")]).toBeDefined();
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
