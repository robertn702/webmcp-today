import { describe, expect, it } from "vitest";
import { matchUrlPattern, rankConfigsByUrl } from "../src/index.js";

const domain = "example.com";

describe("matchUrlPattern", () => {
  it("matches domain-only patterns with score 0", () => {
    const r = matchUrlPattern("example.com", "https://example.com/anything/here", domain);
    expect(r).toEqual({ matched: true, score: 0, params: {} });
  });

  it("matches static segments case-insensitively", () => {
    const r = matchUrlPattern("example.com/Dashboard", "https://example.com/dashboard", domain);
    expect(r.matched).toBe(true);
    expect(r.score).toBe(3);
  });

  it("captures :param segments", () => {
    const r = matchUrlPattern(
      "example.com/items/:id",
      "https://example.com/items/abc-123",
      domain,
    );
    expect(r.matched).toBe(true);
    expect(r.params).toEqual({ id: "abc-123" });
    expect(r.score).toBe(5);
  });

  it("matches ** wildcard for remaining segments", () => {
    const r = matchUrlPattern("example.com/docs/**", "https://example.com/docs/a/b/c", domain);
    expect(r.matched).toBe(true);
    expect(r.score).toBe(3);
  });

  it("rejects when URL has more segments than pattern", () => {
    const r = matchUrlPattern("example.com/docs", "https://example.com/docs/deep", domain);
    expect(r.matched).toBe(false);
  });

  it("rejects when pattern has more segments than URL", () => {
    const r = matchUrlPattern("example.com/docs/:id", "https://example.com/docs", domain);
    expect(r.matched).toBe(false);
  });

  it("handles partial URLs and trailing slashes", () => {
    const r = matchUrlPattern("example.com/a", "example.com/a/", domain);
    expect(r.matched).toBe(true);
  });
});

describe("rankConfigsByUrl", () => {
  it("sorts most-specific-first, domain-only last", () => {
    const configs = [
      { urlPattern: "example.com" },
      { urlPattern: "example.com/items/:id" },
      { urlPattern: "example.com/items/special" },
      { urlPattern: "example.com/other" },
    ];
    const ranked = rankConfigsByUrl(configs, "https://example.com/items/special", domain);
    expect(ranked.map((c) => c.urlPattern)).toEqual([
      "example.com/items/special",
      "example.com/items/:id",
      "example.com",
    ]);
  });
});
