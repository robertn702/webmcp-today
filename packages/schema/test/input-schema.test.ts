import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createPackageSchema, inputSchemaSchema, publishVersionSchema } from "../src/index.js";

// Some providers reject MCP tool schemas containing $ref/$defs (Moonshot/Kimi:
// "references must start with #/$defs/"). inputSchema must stay non-recursive
// so z.toJSONSchema emits it fully inline.

const nested = (depth: number): Record<string, unknown> =>
  depth === 0 ? { type: "string" } : { type: "object", properties: { child: nested(depth - 1) } };

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

describe("inputSchemaSchema nesting", () => {
  it("accepts deeply nested properties beyond the validated depth", () => {
    const result = inputSchemaSchema.safeParse({
      type: "object",
      properties: { root: nested(6) },
    });
    expect(result.success).toBe(true);
  });

  it("still validates within the unrolled depth", () => {
    const result = inputSchemaSchema.safeParse({
      type: "object",
      properties: { root: { type: "object", properties: { child: { description: "no type" } } } },
    });
    expect(result.success).toBe(false);
  });
});
