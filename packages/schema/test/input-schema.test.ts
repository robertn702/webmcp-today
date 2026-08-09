import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createPackageSchema, inputSchemaSchema, publishVersionSchema } from "../src/index.js";

// Some providers reject MCP tool schemas containing $ref/$defs (Moonshot/Kimi:
// "references must start with #/$defs/"). inputSchema must stay non-recursive
// so z.toJSONSchema emits it fully inline. The primitive-only profile enforces
// this structurally: nested objects/arrays have nowhere to hang a $ref.

describe("inputSchema JSON Schema emission", () => {
  it.each([
    ["createPackageSchema", createPackageSchema],
    ["publishVersionSchema", publishVersionSchema],
    ["inputSchemaSchema", inputSchemaSchema],
  ])("%s emits no $ref or $defs", (_name, schema) => {
    const json = JSON.stringify(z.toJSONSchema(schema, { io: "input" }));
    expect(json).not.toContain('"$ref"');
    expect(json).not.toContain('"$defs"');
  });
});

describe("inputSchemaSchema primitive-only profile", () => {
  it("rejects a nested object property", () => {
    const result = inputSchemaSchema.safeParse({
      type: "object",
      properties: { root: { type: "object", properties: {} } },
      additionalProperties: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an array property", () => {
    const result = inputSchemaSchema.safeParse({
      type: "object",
      properties: { tags: { type: "array", items: { type: "string" } } },
      additionalProperties: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a null type", () => {
    const result = inputSchemaSchema.safeParse({
      type: "object",
      properties: { x: { type: "null" } },
      additionalProperties: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keywords on a property (pattern, format, default)", () => {
    for (const extra of [{ pattern: "^a" }, { format: "email" }, { default: "x" }]) {
      const result = inputSchemaSchema.safeParse({
        type: "object",
        properties: { x: { type: "string", ...extra } },
        additionalProperties: false,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects a composition keyword (anyOf/oneOf/allOf) on a property", () => {
    for (const extra of [
      { anyOf: [{ type: "string" }] },
      { oneOf: [{ type: "string" }] },
      { allOf: [{ type: "string" }] },
    ]) {
      const result = inputSchemaSchema.safeParse({
        type: "object",
        properties: { x: extra },
        additionalProperties: false,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects $ref/$defs anywhere in the schema", () => {
    expect(
      inputSchemaSchema.safeParse({
        type: "object",
        properties: {},
        additionalProperties: false,
        $defs: {},
      }).success,
    ).toBe(false);
    expect(
      inputSchemaSchema.safeParse({
        type: "object",
        properties: { x: { $ref: "#/$defs/x" } },
        additionalProperties: false,
      }).success,
    ).toBe(false);
  });

  it("requires additionalProperties: false on the root", () => {
    const result = inputSchemaSchema.safeParse({ type: "object", properties: {} });
    expect(result.success).toBe(false);
  });

  it("rejects a type-incompatible enum", () => {
    const result = inputSchemaSchema.safeParse({
      type: "object",
      properties: { x: { type: "string", enum: [1, 2] } },
      additionalProperties: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a required name that is not declared in properties, and duplicate required names", () => {
    expect(
      inputSchemaSchema.safeParse({
        type: "object",
        properties: { x: { type: "string" } },
        required: ["y"],
        additionalProperties: false,
      }).success,
    ).toBe(false);
    expect(
      inputSchemaSchema.safeParse({
        type: "object",
        properties: { x: { type: "string" } },
        required: ["x", "x"],
        additionalProperties: false,
      }).success,
    ).toBe(false);
  });

  it("rejects more than 20 properties", () => {
    const properties = Object.fromEntries(
      Array.from({ length: 21 }, (_, i) => [`p${i}`, { type: "string" }]),
    );
    const result = inputSchemaSchema.safeParse({
      type: "object",
      properties,
      additionalProperties: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a description over 150 characters", () => {
    const result = inputSchemaSchema.safeParse({
      type: "object",
      properties: { x: { type: "string", description: "a".repeat(151) } },
      additionalProperties: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid primitive-only schema with bounds on every leaf type", () => {
    const result = inputSchemaSchema.safeParse({
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, maxLength: 50 },
        age: { type: "integer", minimum: 0, maximum: 130 },
        score: { type: "number", minimum: 0, maximum: 1 },
        active: { type: "boolean" },
      },
      required: ["name"],
      additionalProperties: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a string property whose minLength exceeds its maxLength", () => {
    const result = inputSchemaSchema.safeParse({
      type: "object",
      properties: { name: { type: "string", minLength: 10, maxLength: 5 } },
      additionalProperties: false,
    });
    expect(result.success).toBe(false);
  });

  it.each(["number", "integer"] as const)(
    "rejects a %s property whose minimum exceeds its maximum",
    (type) => {
      const result = inputSchemaSchema.safeParse({
        type: "object",
        properties: { n: { type, minimum: 10, maximum: 5 } },
        additionalProperties: false,
      });
      expect(result.success).toBe(false);
    },
  );
});
