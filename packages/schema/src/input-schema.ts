import { z } from "zod";

// inputSchema — a constrained JSON Schema object (what WebMCP registerTool
// accepts). Kept permissive (loose objects) but bounded.

export interface JsonSchemaProperty extends Record<string, unknown> {
  type: string;
  description?: string;
  enum?: unknown[];
  items?: Record<string, unknown>;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

const jsonSchemaPropertySchema: z.ZodType<JsonSchemaProperty> = z.lazy(() =>
  z.looseObject({
    type: z.string().max(50),
    description: z.string().max(1000).optional(),
    enum: z.array(z.unknown()).optional(),
    items: z.record(z.string(), z.unknown()).optional(),
    properties: z.record(z.string(), jsonSchemaPropertySchema).optional(),
    required: z.array(z.string()).optional(),
  }),
);

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

export type InputSchema = z.infer<typeof inputSchemaSchema>;
