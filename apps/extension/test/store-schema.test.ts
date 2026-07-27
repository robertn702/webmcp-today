import { describe, expect, it } from "vitest";
import {
  INDEX_KEY,
  PKG_KEY_PREFIX,
  REVOKED_KEY,
  SCHEMA_VERSION_KEY,
  STORAGE_SCHEMA_VERSION,
  indexEntrySchema,
  indexSchema,
  pkgKey,
  revokedDocSchema,
} from "../src/lib/store-schema.js";

const ENTRY = {
  packageId: "pkg-1",
  versionId: "ver-1",
  version: 2,
  domain: "en.wikipedia.org",
  urlPatterns: ["*://en.wikipedia.org/wiki/*"],
  title: "Wikipedia article",
  installedAt: "2026-07-27T12:00:00.000Z",
  source: "registry",
  origin: "https://webmcp.cafe",
};

describe("store-schema", () => {
  it("pins the storage layout constants", () => {
    expect(STORAGE_SCHEMA_VERSION).toBe(1);
    expect(SCHEMA_VERSION_KEY).toBe("schemaVersion");
    expect(INDEX_KEY).toBe("index");
    expect(REVOKED_KEY).toBe("revoked");
    expect(pkgKey("abc")).toBe("pkg:abc");
    expect(pkgKey("abc").startsWith(PKG_KEY_PREFIX)).toBe(true);
  });

  it("parses a minimal index entry and one with the optional fields", () => {
    expect(indexEntrySchema.parse(ENTRY)).toEqual(ENTRY);
    const full = { ...ENTRY, minEngine: 2, apiContentHash: "a".repeat(64) };
    expect(indexEntrySchema.parse(full)).toEqual(full);
  });

  it.each([
    ["empty urlPatterns", { ...ENTRY, urlPatterns: [] }],
    ["non-ISO installedAt", { ...ENTRY, installedAt: "yesterday" }],
    ["unknown source", { ...ENTRY, source: "bundled" }],
    ["missing origin", { ...ENTRY, origin: undefined }],
    ["zero version", { ...ENTRY, version: 0 }],
  ])("rejects an index entry with %s", (_label, entry) => {
    expect(indexEntrySchema.safeParse(entry).success).toBe(false);
  });

  it("parses the index as a record keyed by packageId", () => {
    expect(indexSchema.parse({})).toEqual({});
    expect(indexSchema.parse({ [ENTRY.packageId]: ENTRY })).toEqual({ [ENTRY.packageId]: ENTRY });
    expect(indexSchema.safeParse({ [ENTRY.packageId]: { broken: true } }).success).toBe(false);
  });

  it("parses the revocation doc and rejects malformed cursors", () => {
    const doc = {
      cursor: 4,
      fetchedAt: "2026-07-27T12:00:00.000Z",
      entries: [
        {
          id: 4,
          packageId: "pkg-1",
          versionId: null,
          reason: "malware",
          revokedAt: "2026-07-27T11:00:00.000Z",
        },
      ],
    };
    expect(revokedDocSchema.parse(doc)).toEqual(doc);
    expect(revokedDocSchema.parse({ ...doc, entries: [] }).entries).toEqual([]);
    expect(revokedDocSchema.safeParse({ ...doc, cursor: -1 }).success).toBe(false);
    expect(revokedDocSchema.safeParse({ ...doc, fetchedAt: undefined }).success).toBe(false);
  });
});
