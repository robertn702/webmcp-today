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
    expect(hackerNews?.api.endpoints.item).toEqual({
      method: "GET",
      baseUrl: "https://hacker-news.firebaseio.com",
      path: "/v0/item/{{itemId}}.json",
      returns:
        "id && {id: id, type: type, by: by, time: time, title: title, text: text, url: url, score: score, descendants: descendants, parent: parent, kids: kids, deleted: deleted, dead: dead, parts: parts, poll: poll}",
    });
    expect(hackerNews?.api.endpoints.children).toEqual({
      method: "GET",
      baseUrl: "https://hacker-news.firebaseio.com",
      path: "/v0/item/{{itemId}}.json",
      returns: "id && {id: id, type: type, kids: kids || `[]`}",
    });
    expect(hackerNews?.tools.find((tool) => tool.name === "hn_get_item")).toMatchObject({
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execution: { mode: "api", endpoint: "item" },
    });
    expect(hackerNews?.tools.find((tool) => tool.name === "hn_list_children")).toMatchObject({
      annotations: { readOnlyHint: true },
      execution: { mode: "api", endpoint: "children" },
    });
  });
});
