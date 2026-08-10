import { describe, expect, it } from "vitest";
import { curatedPackages } from "../src/index.js";

describe("curated packages", () => {
  it("contains all curated packages", () => {
    expect(curatedPackages).toHaveLength(3);
  });

  it("has unique domains", () => {
    const domains = curatedPackages.map((d) => d.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it("every package has at least one tool", () => {
    for (const pkg of curatedPackages) {
      expect(pkg.tools.length).toBeGreaterThan(0);
    }
  });

  it("includes the Hacker News public item and child-list read tools", () => {
    const hackerNews = curatedPackages.find((pkg) => pkg.domain === "news.ycombinator.com");
    expect(hackerNews?.tools.map((tool) => tool.name)).toContain("hn_get_item");
    expect(hackerNews?.tools.map((tool) => tool.name)).toContain("hn_list_children");
    expect(hackerNews?.api.endpoints.item?.baseUrl).toBe("https://hacker-news.firebaseio.com");
    expect(hackerNews?.api.endpoints.item?.path).toBe("/v0/item/{{itemId}}.json");
    expect(hackerNews?.api.endpoints.children?.returns).toBe(
      "id && {id: id, type: type, kids: kids || `[]`}",
    );
    expect(hackerNews?.tools.find((tool) => tool.name === "hn_get_item")?.annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
  });
});
