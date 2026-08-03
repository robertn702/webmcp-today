import { describe, expect, it } from "vitest";
import type { RevocationEntry } from "@robertn702/webmcp-today-schema";
import { findRevocation, matchInstalled } from "../src/lib/match-installed.js";
import type { IndexEntry, InstallIndex } from "../src/lib/store-schema.js";

function entry(overrides: Partial<IndexEntry> & Pick<IndexEntry, "packageId">): IndexEntry {
  return {
    versionId: `${overrides.packageId}-v1`,
    version: 1,
    domain: "example.com",
    urlPatterns: ["*://example.com/*"],
    title: overrides.packageId,
    installedAt: "2026-07-27T00:00:00.000Z",
    source: "registry",
    origin: "https://webmcp.today",
    ...overrides,
  };
}

function index(...entries: IndexEntry[]): InstallIndex {
  return Object.fromEntries(entries.map((e) => [e.packageId, e]));
}

describe("matchInstalled", () => {
  it("matches an install on its exact domain and pattern", () => {
    const idx = index(entry({ packageId: "a" }));
    const matched = matchInstalled(idx, "https://example.com/page");
    expect(matched.map((e) => e.packageId)).toEqual(["a"]);
  });

  it("matches a registrable-domain install on subdomains via lookup keys", () => {
    const idx = index(
      entry({
        packageId: "wiki",
        domain: "wikipedia.org",
        urlPatterns: ["*://*.wikipedia.org/wiki/*"],
      }),
    );
    const matched = matchInstalled(idx, "https://en.wikipedia.org/wiki/Coffee");
    expect(matched.map((e) => e.packageId)).toEqual(["wiki"]);
  });

  it("filters out installs for other domains before pattern matching", () => {
    const idx = index(
      entry({ packageId: "a" }),
      entry({ packageId: "b", domain: "other.net", urlPatterns: ["*://other.net/*"] }),
    );
    const matched = matchInstalled(idx, "https://example.com/");
    expect(matched.map((e) => e.packageId)).toEqual(["a"]);
  });

  it("drops installs whose domain matches but urlPatterns do not", () => {
    const idx = index(entry({ packageId: "a", urlPatterns: ["*://example.com/docs/*"] }));
    expect(matchInstalled(idx, "https://example.com/blog/post")).toEqual([]);
  });

  it("fails closed for legacy installs whose pattern exceeds their visible domain", () => {
    const idx = index(
      entry({ packageId: "global", urlPatterns: ["*://*/*"] }),
      entry({
        packageId: "misleading",
        domain: "example.com",
        urlPatterns: ["*://news.ycombinator.com/*"],
      }),
    );
    expect(matchInstalled(idx, "https://example.com/page")).toEqual([]);
    expect(matchInstalled(idx, "https://news.ycombinator.com/")).toEqual([]);
  });

  it("ranks exact-host patterns above wildcard-host patterns", () => {
    const idx = index(
      entry({
        packageId: "wild",
        domain: "example.com",
        urlPatterns: ["*://*.example.com/*"],
      }),
      entry({
        packageId: "exact",
        domain: "example.com",
        urlPatterns: ["*://example.com/*"],
      }),
    );
    const matched = matchInstalled(idx, "https://example.com/page");
    expect(matched.map((e) => e.packageId)).toEqual(["exact", "wild"]);
  });

  it("returns nothing for an unparsable URL", () => {
    expect(matchInstalled(index(entry({ packageId: "a" })), "not a url")).toEqual([]);
  });
});

describe("findRevocation", () => {
  const revocations: RevocationEntry[] = [
    {
      id: 1,
      packageId: "whole",
      versionId: null,
      reason: "malware",
      revokedAt: "2026-07-27T00:00:00.000Z",
    },
    {
      id: 2,
      packageId: "scoped",
      versionId: "scoped-v2",
      reason: "broken selector",
      revokedAt: "2026-07-27T00:00:00.000Z",
    },
  ];

  it("a null versionId revokes every version of the package", () => {
    const hit = findRevocation(revocations, { packageId: "whole", versionId: "whole-v9" });
    expect(hit?.reason).toBe("malware");
  });

  it("a version-scoped revocation hits only that exact version", () => {
    expect(
      findRevocation(revocations, { packageId: "scoped", versionId: "scoped-v2" }),
    ).toBeDefined();
    expect(
      findRevocation(revocations, { packageId: "scoped", versionId: "scoped-v3" }),
    ).toBeUndefined();
  });

  it("returns undefined for an unrevoked package", () => {
    expect(findRevocation(revocations, { packageId: "clean", versionId: "v1" })).toBeUndefined();
  });
});
