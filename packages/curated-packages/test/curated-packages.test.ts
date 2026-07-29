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
});
