import { describe, expect, it } from "vitest";
import { revocationEntrySchema, revocationsResponseSchema } from "../src/registry.js";

// Wire schemas shared by the registry and the extension: the client validates
// every revocation response against them before letting it disable an installed
// package, so the boundary is worth pinning on both sides.

const entry = {
  id: 1,
  packageId: "pkg-1",
  versionId: null,
  reason: "Exfiltrated form values",
  revokedAt: "2026-07-25T00:00:00.000Z",
};

describe("revocationEntrySchema", () => {
  it("accepts a whole-package revocation (null versionId)", () => {
    expect(revocationEntrySchema.safeParse(entry).success).toBe(true);
  });

  it("accepts a version-scoped revocation", () => {
    expect(revocationEntrySchema.safeParse({ ...entry, versionId: "ver-2" }).success).toBe(true);
  });

  it("rejects a versionId that is absent rather than explicitly null", () => {
    const { versionId: _versionId, ...withoutVersionId } = entry;
    expect(revocationEntrySchema.safeParse(withoutVersionId).success).toBe(false);
  });

  it("rejects an id that could not be a cursor", () => {
    expect(revocationEntrySchema.safeParse({ ...entry, id: 0 }).success).toBe(false);
    expect(revocationEntrySchema.safeParse({ ...entry, id: -1 }).success).toBe(false);
    expect(revocationEntrySchema.safeParse({ ...entry, id: 1.5 }).success).toBe(false);
    expect(revocationEntrySchema.safeParse({ ...entry, id: "1" }).success).toBe(false);
  });

  it("rejects a revokedAt that is not an ISO datetime", () => {
    expect(revocationEntrySchema.safeParse({ ...entry, revokedAt: "2026-07-25" }).success).toBe(
      false,
    );
  });
});

describe("revocationsResponseSchema", () => {
  it("accepts an empty feed", () => {
    expect(revocationsResponseSchema.safeParse({ cursor: 0, latest: 0, entries: [] }).success).toBe(
      true,
    );
  });

  it("accepts a feed with entries", () => {
    expect(
      revocationsResponseSchema.safeParse({ cursor: 1, latest: 1, entries: [entry] }).success,
    ).toBe(true);
  });

  it("rejects a feed carrying a malformed entry", () => {
    const result = revocationsResponseSchema.safeParse({
      cursor: 1,
      latest: 1,
      entries: [{ ...entry, reason: 42 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a feed missing latest", () => {
    expect(revocationsResponseSchema.safeParse({ cursor: 0, entries: [] }).success).toBe(false);
  });
});
