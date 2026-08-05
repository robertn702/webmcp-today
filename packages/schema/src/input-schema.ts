import { z } from "zod";

// inputSchema — a constrained JSON Schema object (what WebMCP registerTool
// accepts). Kept permissive (loose objects) but bounded.
//
// Nesting is unrolled to a fixed depth instead of expressed with z.lazy: a
// recursive zod schema forces z.toJSONSchema to hoist the cycle into `$defs`
// and emit `$ref`s, and some providers reject MCP tool schemas containing
// them (Moonshot/Kimi: "references must start with #/$defs/"). Unrolling keeps
// the emitted schema fully inline. Below the unrolled depth properties are
// accepted but not validated, so this is strictly more permissive than the
// recursive version — nothing that parsed before stops parsing.

/** A nested object accepted as-is, past the depth we bother validating. */
const unvalidatedObject = () => z.record(z.string(), z.unknown());

const propertyFields = <T extends z.ZodType>(nested: T) => ({
  type: z.string().max(50),
  description: z.string().max(1000).optional(),
  enum: z.array(z.unknown()).optional(),
  items: z.record(z.string(), z.unknown()).optional(),
  properties: z.record(z.string(), nested).optional(),
  required: z.array(z.string()).optional(),
});

// Three validated levels, innermost first.
const depth3 = z.looseObject(propertyFields(unvalidatedObject()));
const depth2 = z.looseObject(propertyFields(depth3));
const jsonSchemaPropertySchema = z.looseObject(propertyFields(depth2));

export const inputSchemaSchema = z
  .looseObject({
    type: z.literal("object"),
    properties: z.record(z.string(), jsonSchemaPropertySchema).default({}),
    required: z.array(z.string()).optional(),
  })
  .check((ctx) => {
    if (Object.keys(ctx.value.properties).length > 20) {
      ctx.issues.push({
        code: "custom",
        message: "inputSchema may have at most 20 properties",
        path: ["properties"],
        input: ctx.value.properties,
      });
    }
  });

export type JsonSchemaProperty = z.infer<typeof jsonSchemaPropertySchema>;
export type InputSchema = z.infer<typeof inputSchemaSchema>;
