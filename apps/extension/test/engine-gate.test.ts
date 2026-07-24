import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "@robertn702/webmcp-cafe-schema";
import { requiredEngineLevel, supportsConfigEngine } from "../src/lib/engine-gate.js";

describe("engine-gate", () => {
  it("defaults a config without minEngine to level 1", () => {
    expect(requiredEngineLevel({})).toBe(1);
    expect(requiredEngineLevel({ minEngine: 3 })).toBe(3);
  });

  it("accepts configs at or below the executor's engine level", () => {
    expect(supportsConfigEngine({}, 1)).toBe(true);
    expect(supportsConfigEngine({ minEngine: 1 }, 1)).toBe(true);
    expect(supportsConfigEngine({ minEngine: 2 }, 5)).toBe(true);
  });

  it("rejects configs requiring a newer engine than the executor", () => {
    expect(supportsConfigEngine({ minEngine: 2 }, 1)).toBe(false);
    expect(supportsConfigEngine({ minEngine: ENGINE_VERSION + 1 })).toBe(false);
  });

  it("uses ENGINE_VERSION as the default ceiling", () => {
    expect(supportsConfigEngine({ minEngine: ENGINE_VERSION })).toBe(true);
  });
});
