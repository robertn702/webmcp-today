import { describe, expect, it } from "vitest";
import {
  revocationEntrySchema,
  revocationsResponseSchema,
  webMcpPackageSchema,
} from "../src/registry.js";

// A served envelope carries the same domain/urlPatterns/tools/api shape as a
// submission plus registry-assigned fields (id, versionId, contributor, …).
// `webMcpPackageSchema` reuses createPackageSchema's cross-field checks
// (applyDomainCrossValidation) so a legacy DB row that predates one of those
// checks fails closed at serve time instead of being served as-is.
const servedPackage = {
  id: "pkg-1",
  versionId: "ver-1",
  version: 1,
  domain: "acme.com",
  urlPatterns: ["*://acme.com/*"],
  title: "Example",
  description: "Search tools for acme.com",
  contributor: "robert",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
  minEngine: 1,
  tools: [
    {
      name: "search",
      description: "Search the site",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execution: { mode: "api", endpoint: "search" },
    },
  ],
  api: {
    baseUrl: "https://acme.com",
    endpoints: { search: { method: "GET", path: "/search" } },
  },
};

describe("webMcpPackageSchema", () => {
  it("accepts a well-formed served envelope", () => {
    expect(webMcpPackageSchema.safeParse(servedPackage).success).toBe(true);
  });

  it("tolerates an unrecognized top-level field (forward compatibility)", () => {
    const result = webMcpPackageSchema.safeParse({ ...servedPackage, futureField: "kept" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.futureField).toBe("kept");
  });

  it("rejects a legacy row whose urlPatterns exceed its visible domain", () => {
    const result = webMcpPackageSchema.safeParse({
      ...servedPackage,
      urlPatterns: ["*://*/*"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a legacy row whose api.baseUrl escapes its visible domain", () => {
    const result = webMcpPackageSchema.safeParse({
      ...servedPackage,
      api: { ...servedPackage.api, baseUrl: "https://evil.example.com" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a row with an empty tools array (structural, not just domain scope)", () => {
    const result = webMcpPackageSchema.safeParse({ ...servedPackage, tools: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an id that is present but empty", () => {
    expect(webMcpPackageSchema.safeParse({ ...servedPackage, id: "" }).success).toBe(false);
  });
});

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
