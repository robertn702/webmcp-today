import { describe, expect, it } from "vitest";
import { definitions } from "../src/index.js";

describe("curated definitions", () => {
  it("contains all curated packages", () => {
    expect(definitions).toHaveLength(1);
  });

  it("has unique domains", () => {
    const domains = definitions.map((d) => d.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it("every package has at least one tool", () => {
    for (const definition of definitions) {
      expect(definition.tools.length).toBeGreaterThan(0);
    }
  });
});
