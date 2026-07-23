import type { ToolField } from "./fields.js";
import type { InputSchema, JsonSchemaProperty } from "./input-schema.js";

/**
 * Converts a ToolField array into a JSON Schema inputSchema.
 * Ported from Joakim Selemyr's web-mcp-hub (MIT).
 */
export function deriveInputSchema(fields: ToolField[]): InputSchema {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const field of fields) {
    const prop: JsonSchemaProperty = { type: "string", description: field.description };

    switch (field.type) {
      case "text":
      case "textarea":
      case "hidden":
        break;
      case "date":
        prop.format = "date";
        break;
      case "number":
        prop.type = "number";
        break;
      case "checkbox":
        prop.type = "boolean";
        break;
      case "select":
      case "radio": {
        const options = field.options ?? [];
        if (options.length > 0) {
          prop.enum = options.map((o) => o.value);
          prop.oneOf = options.map((o) => ({ const: o.value, title: o.label }));
        }
        break;
      }
    }

    if (field.defaultValue !== undefined) prop.default = field.defaultValue;
    properties[field.name] = prop;
    // required defaults to true when not specified
    if (field.required !== false) required.push(field.name);
  }

  return { type: "object", properties, required };
}
