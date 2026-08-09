import { describe, expect, it } from "vitest";
import { type InputSchema, validateToolInput } from "../src/index.js";

const schema: InputSchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 10 },
    age: { type: "integer", minimum: 0, maximum: 130 },
    score: { type: "number", minimum: 0, maximum: 1 },
    active: { type: "boolean" },
    direction: { type: "string", enum: ["up", "down"] },
  },
  required: ["name"],
  additionalProperties: false,
};

describe("validateToolInput", () => {
  it("succeeds with the exact input values on a fully valid call", () => {
    const result = validateToolInput(schema, { name: "a", age: 30, active: true });
    expect(result).toEqual({ success: true, data: { name: "a", age: 30, active: true } });
  });

  it("succeeds with an empty object when no properties are required", () => {
    const empty: InputSchema = { type: "object", properties: {}, additionalProperties: false };
    expect(validateToolInput(empty, {})).toEqual({ success: true, data: {} });
  });

  it("rejects non-plain-object input (array, null, primitive)", () => {
    for (const input of [[], null, "x", 1, true]) {
      const result = validateToolInput(schema, input);
      expect(result.success).toBe(false);
    }
  });

  it("reports a missing required property", () => {
    const result = validateToolInput(schema, {});
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.issues).toContainEqual({
      path: ["name"],
      message: "Required property is missing",
    });
  });

  it("reports an unknown/extra property", () => {
    const result = validateToolInput(schema, { name: "a", bogus: 1 });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.issues).toContainEqual({ path: ["bogus"], message: "Unknown property" });
  });

  it("reports a wrong-type value per property type", () => {
    expect(validateToolInput(schema, { name: 1 }).success).toBe(false);
    expect(validateToolInput(schema, { name: "a", age: "30" }).success).toBe(false);
    expect(validateToolInput(schema, { name: "a", active: "true" }).success).toBe(false);
  });

  it("reports an enum violation", () => {
    const result = validateToolInput(schema, { name: "a", direction: "sideways" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.issues).toContainEqual({
      path: ["direction"],
      message: "Value is not in the allowed enum",
    });
  });

  it("enforces string minLength/maxLength", () => {
    expect(validateToolInput(schema, { name: "" }).success).toBe(false);
    expect(validateToolInput(schema, { name: "a".repeat(11) }).success).toBe(false);
    expect(validateToolInput(schema, { name: "a".repeat(10) }).success).toBe(true);
  });

  it("enforces numeric minimum/maximum", () => {
    expect(validateToolInput(schema, { name: "a", age: -1 }).success).toBe(false);
    expect(validateToolInput(schema, { name: "a", age: 131 }).success).toBe(false);
    expect(validateToolInput(schema, { name: "a", score: 1.5 }).success).toBe(false);
  });

  it("rejects non-finite numbers (NaN, Infinity)", () => {
    expect(validateToolInput(schema, { name: "a", score: Number.NaN }).success).toBe(false);
    expect(validateToolInput(schema, { name: "a", score: Number.POSITIVE_INFINITY }).success).toBe(
      false,
    );
  });

  it("rejects an unsafe integer", () => {
    const result = validateToolInput(schema, {
      name: "a",
      age: Number.MAX_SAFE_INTEGER + 10,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a safe integer at the boundary", () => {
    const boundarySchema: InputSchema = {
      type: "object",
      properties: { n: { type: "integer" } },
      additionalProperties: false,
    };
    expect(validateToolInput(boundarySchema, { n: Number.MAX_SAFE_INTEGER }).success).toBe(true);
  });

  it("rejects input serializing over the 64 KiB limit", () => {
    const bigSchema: InputSchema = {
      type: "object",
      properties: { text: { type: "string" } },
      additionalProperties: false,
    };
    const result = validateToolInput(bigSchema, { text: "a".repeat(70_000) });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.issues).toContainEqual({
      path: [],
      message: "Tool input must not exceed 64 KiB when serialized",
    });
  });

  it("accepts input at just under the 64 KiB limit", () => {
    const bigSchema: InputSchema = {
      type: "object",
      properties: { text: { type: "string" } },
      additionalProperties: false,
    };
    // Leaves headroom for the surrounding `{"text":"..."}` JSON envelope.
    const result = validateToolInput(bigSchema, { text: "a".repeat(65_000) });
    expect(result.success).toBe(true);
  });

  it("rejects multibyte UTF-8 input whose byte length exceeds 64 KiB despite a small JS string length", () => {
    const bigSchema: InputSchema = {
      type: "object",
      properties: { text: { type: "string" } },
      additionalProperties: false,
    };
    // "€" is 1 UTF-16 code unit (JS .length) but 3 UTF-8 bytes — 25,000 of them
    // is a 25,000-char string but ~75,000 bytes, well over the 64 KiB limit a
    // naive .length-based check would have missed.
    const text = "€".repeat(25_000);
    expect(text.length).toBeLessThan(64 * 1024);
    const result = validateToolInput(bigSchema, { text });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.issues).toContainEqual({
      path: [],
      message: "Tool input must not exceed 64 KiB when serialized",
    });
  });

  it("accepts multibyte UTF-8 input within the 64 KiB byte budget", () => {
    const bigSchema: InputSchema = {
      type: "object",
      properties: { text: { type: "string" } },
      additionalProperties: false,
    };
    const text = "€".repeat(1_000);
    const result = validateToolInput(bigSchema, { text });
    expect(result).toEqual({ success: true, data: { text } });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = { name: "a", age: 30 };
    const first = validateToolInput(schema, input);
    const second = validateToolInput(schema, input);
    expect(first).toEqual(second);
  });
});
