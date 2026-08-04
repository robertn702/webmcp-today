import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "@webmcp-today/schema";
import { requiredEngineLevel, supportsPackageEngine } from "../src/engine-gate.js";

describe("engine-gate", () => {
  it("defaults a package without minEngine to level 1", () => {
    expect(requiredEngineLevel({})).toBe(1);
    expect(requiredEngineLevel({ minEngine: 3 })).toBe(3);
  });

  it("accepts packages at or below the executor's engine level", () => {
    expect(supportsPackageEngine({}, 1)).toBe(true);
    expect(supportsPackageEngine({ minEngine: 1 }, 1)).toBe(true);
    expect(supportsPackageEngine({ minEngine: 2 }, 5)).toBe(true);
  });

  it("rejects packages requiring a newer engine than the executor", () => {
    expect(supportsPackageEngine({ minEngine: 2 }, 1)).toBe(false);
    expect(supportsPackageEngine({ minEngine: ENGINE_VERSION + 1 })).toBe(false);
  });

  it("uses ENGINE_VERSION as the default ceiling", () => {
    expect(supportsPackageEngine({ minEngine: ENGINE_VERSION })).toBe(true);
  });
});
