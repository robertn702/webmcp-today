import { describe, expect, it } from "vitest";
import { deriveInputSchema, toolFieldSchema } from "../src/index.js";

describe("deriveInputSchema", () => {
  it("derives types, required, defaults, and enums from fields", () => {
    const fields = [
      toolFieldSchema.parse({
        type: "text",
        selector: "#q",
        name: "query",
        description: "Search query",
      }),
      toolFieldSchema.parse({
        type: "number",
        selector: "#n",
        name: "count",
        description: "Result count",
        required: false,
        defaultValue: 10,
      }),
      toolFieldSchema.parse({
        type: "checkbox",
        selector: "#x",
        name: "exact",
        description: "Exact match",
        required: false,
      }),
      toolFieldSchema.parse({
        type: "select",
        selector: "#s",
        name: "sort",
        description: "Sort order",
        options: [
          { value: "new", label: "Newest" },
          { value: "top", label: "Top" },
        ],
      }),
      toolFieldSchema.parse({
        type: "date",
        selector: "#d",
        name: "since",
        description: "Start date",
        required: false,
      }),
    ];

    const schema = deriveInputSchema(fields);
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["query", "sort"]);
    expect(schema.properties.query).toMatchObject({ type: "string" });
    expect(schema.properties.count).toMatchObject({ type: "number", default: 10 });
    expect(schema.properties.exact).toMatchObject({ type: "boolean" });
    expect(schema.properties.sort).toMatchObject({ type: "string", enum: ["new", "top"] });
    expect(schema.properties.sort?.oneOf).toEqual([
      { const: "new", title: "Newest" },
      { const: "top", title: "Top" },
    ]);
    expect(schema.properties.since).toMatchObject({ type: "string", format: "date" });
  });
});
