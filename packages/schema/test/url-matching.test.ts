import { describe, expect, it } from "vitest";
import { matchUrlPattern, parseUrlPattern, rankConfigsByUrl } from "../src/index.js";

describe("parseUrlPattern", () => {
  it("parses scheme, host, and path", () => {
    expect(parseUrlPattern("*://*.wikipedia.org/wiki/*")).toEqual({
      scheme: "*",
      host: "*.wikipedia.org",
      path: "/wiki/*",
    });
  });

  it("rejects patterns without a path", () => {
    expect(parseUrlPattern("*://example.com")).toBeNull();
  });

  it("rejects patterns without a scheme separator", () => {
    expect(parseUrlPattern("example.com/wiki")).toBeNull();
  });
});

describe("matchUrlPattern", () => {
  it("matches a wildcard scheme + subdomain wildcard + wildcard path", () => {
    const r = matchUrlPattern("*://*.wikipedia.org/wiki/*", "https://en.wikipedia.org/wiki/Cat");
    expect(r.matched).toBe(true);
  });

  it("matches an exact host more specifically than a subdomain wildcard", () => {
    const exact = matchUrlPattern("*://en.wikipedia.org/*", "https://en.wikipedia.org/wiki/Cat");
    const wildcard = matchUrlPattern("*://*.wikipedia.org/*", "https://en.wikipedia.org/wiki/Cat");
    expect(exact.matched).toBe(true);
    expect(wildcard.matched).toBe(true);
    expect(exact.score).toBeGreaterThan(wildcard.score);
  });

  it("rejects a host that doesn't match", () => {
    const r = matchUrlPattern("*://*.wikipedia.org/*", "https://example.com/wiki/Cat");
    expect(r.matched).toBe(false);
  });

  it("rejects a non-matching literal path segment", () => {
    const r = matchUrlPattern("*://example.com/dashboard", "https://example.com/settings");
    expect(r.matched).toBe(false);
  });

  it("restricts an explicit scheme", () => {
    const r = matchUrlPattern("https://example.com/*", "http://example.com/a");
    expect(r.matched).toBe(false);
  });

  it("rejects invalid patterns", () => {
    expect(matchUrlPattern("example.com", "https://example.com/").matched).toBe(false);
  });

  it("rejects unparseable URLs", () => {
    expect(matchUrlPattern("*://*.example.com/*", "not a url").matched).toBe(false);
  });
});

describe("rankConfigsByUrl", () => {
  it("sorts most-specific-first: host specificity dominates, path breaks ties", () => {
    const configs = [
      { id: "wildcard-path", urlPatterns: ["*://*.example.com/*"] },
      { id: "exact-path", urlPatterns: ["*://*.example.com/items/special"] },
      { id: "exact-host", urlPatterns: ["*://example.com/items/*"] },
      { id: "no-match", urlPatterns: ["*://*.other.com/*"] },
    ];
    const ranked = rankConfigsByUrl(configs, "https://example.com/items/special");
    expect(ranked.map((c) => c.id)).toEqual(["exact-host", "exact-path", "wildcard-path"]);
  });

  it("ranks a more specific path higher when hosts tie", () => {
    const configs = [
      { id: "wildcard-path", urlPatterns: ["*://example.com/*"] },
      { id: "exact-path", urlPatterns: ["*://example.com/items/special"] },
    ];
    const ranked = rankConfigsByUrl(configs, "https://example.com/items/special");
    expect(ranked.map((c) => c.id)).toEqual(["exact-path", "wildcard-path"]);
  });

  it("picks the best-matching pattern when an item has several", () => {
    const configs = [{ id: "multi", urlPatterns: ["*://*.example.com/*", "*://example.com/a"] }];
    const ranked = rankConfigsByUrl(configs, "https://example.com/a");
    expect(ranked).toHaveLength(1);
  });
});
