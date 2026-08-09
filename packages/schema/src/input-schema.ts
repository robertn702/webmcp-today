import { z } from "zod";
import { PARAM_DESCRIPTION_MAX } from "./budgets.js";

// inputSchema is deliberately smaller than general JSON Schema. Keeping the
// profile primitive-only makes author input auditable and keeps the schema sent
// to MCP clients fully inline, without $ref/$defs.

const INPUT_BYTES_MAX = 64 * 1024;

const descriptionSchema = z.string().max(PARAM_DESCRIPTION_MAX).optional();

const stringPropertySchema = z
  .strictObject({
    type: z.literal("string"),
    description: descriptionSchema,
    enum: z.array(z.string()).min(1).optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().nonnegative().optional(),
  })
  .superRefine((property, ctx) => {
    if (
      property.minLength !== undefined &&
      property.maxLength !== undefined &&
      property.minLength > property.maxLength
    ) {
      ctx.addIssue({
        code: "custom",
        message: "minLength must be less than or equal to maxLength",
        path: ["minLength"],
      });
    }
  });

const numberFields = {
  description: descriptionSchema,
  minimum: z.number().optional(),
  maximum: z.number().optional(),
};

const numberPropertySchema = z
  .strictObject({
    type: z.literal("number"),
    ...numberFields,
    enum: z.array(z.number()).min(1).optional(),
  })
  .superRefine((property, ctx) => {
    if (
      property.minimum !== undefined &&
      property.maximum !== undefined &&
      property.minimum > property.maximum
    ) {
      ctx.addIssue({
        code: "custom",
        message: "minimum must be less than or equal to maximum",
        path: ["minimum"],
      });
    }
  });

const safeIntegerSchema = z
  .number()
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);

const integerPropertySchema = z
  .strictObject({
    type: z.literal("integer"),
    description: descriptionSchema,
    enum: z.array(safeIntegerSchema).min(1).optional(),
    minimum: safeIntegerSchema.optional(),
    maximum: safeIntegerSchema.optional(),
  })
  .superRefine((property, ctx) => {
    if (
      property.minimum !== undefined &&
      property.maximum !== undefined &&
      property.minimum > property.maximum
    ) {
      ctx.addIssue({
        code: "custom",
        message: "minimum must be less than or equal to maximum",
        path: ["minimum"],
      });
    }
  });

const booleanPropertySchema = z.strictObject({
  type: z.literal("boolean"),
  description: descriptionSchema,
  enum: z.array(z.boolean()).min(1).optional(),
});

export const jsonSchemaPropertySchema = z.discriminatedUnion("type", [
  stringPropertySchema,
  numberPropertySchema,
  integerPropertySchema,
  booleanPropertySchema,
]);

export const inputSchemaSchema = z
  .strictObject({
    type: z.literal("object"),
    properties: z.record(z.string(), jsonSchemaPropertySchema).default({}),
    required: z.array(z.string()).optional(),
    additionalProperties: z.literal(false),
  })
  .superRefine((schema, ctx) => {
    if (Object.keys(schema.properties).length > 20) {
      ctx.addIssue({
        code: "custom",
        message: "inputSchema may have at most 20 properties",
        path: ["properties"],
      });
    }

    const seen = new Set<string>();
    for (const [index, name] of (schema.required ?? []).entries()) {
      if (seen.has(name)) {
        ctx.addIssue({
          code: "custom",
          message: `Required property "${name}" must be unique`,
          path: ["required", index],
        });
      } else if (!Object.hasOwn(schema.properties, name)) {
        ctx.addIssue({
          code: "custom",
          message: `Required property "${name}" is not declared in properties`,
          path: ["required", index],
        });
      }
      seen.add(name);
    }
  });

export type JsonSchemaProperty = z.infer<typeof jsonSchemaPropertySchema>;
export type InputSchema = z.infer<typeof inputSchemaSchema>;
export type ToolInputValue = string | number | boolean;

export interface ToolInputValidationIssue {
  path: string[];
  message: string;
}

export type ToolInputValidationResult =
  | { success: true; data: Record<string, ToolInputValue> }
  | { success: false; issues: ToolInputValidationIssue[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function enumIncludes(property: JsonSchemaProperty, value: ToolInputValue): boolean {
  if (property.enum === undefined) return true;
  if (property.type === "string" && typeof value === "string") {
    return property.enum.includes(value);
  }
  if (property.type === "number" && typeof value === "number") {
    return property.enum.includes(value);
  }
  if (property.type === "integer" && typeof value === "number") {
    return property.enum.includes(value);
  }
  if (property.type === "boolean" && typeof value === "boolean") {
    return property.enum.includes(value);
  }
  return false;
}

/** Validate one tool invocation against the primitive input-schema profile. */
export function validateToolInput(schema: InputSchema, input: unknown): ToolInputValidationResult {
  if (!isPlainObject(input)) {
    return {
      success: false,
      issues: [{ path: [], message: "Tool input must be a plain object" }],
    };
  }

  const issues: ToolInputValidationIssue[] = [];
  for (const name of schema.required ?? []) {
    if (!Object.hasOwn(input, name)) {
      issues.push({ path: [name], message: "Required property is missing" });
    }
  }

  const declaredNames = new Set(Object.keys(schema.properties));
  for (const name of Object.keys(input).sort()) {
    if (!declaredNames.has(name)) {
      issues.push({ path: [name], message: "Unknown property" });
    }
  }

  const data: Record<string, ToolInputValue> = Object.create(null);
  for (const [name, property] of Object.entries(schema.properties)) {
    if (!Object.hasOwn(input, name)) continue;
    const value = input[name];

    if (property.type === "string") {
      if (typeof value !== "string") {
        issues.push({ path: [name], message: "Expected string" });
        continue;
      }
      if (!enumIncludes(property, value)) {
        issues.push({ path: [name], message: "Value is not in the allowed enum" });
      }
      if (property.minLength !== undefined && value.length < property.minLength) {
        issues.push({
          path: [name],
          message: `String must contain at least ${property.minLength} characters`,
        });
      }
      if (property.maxLength !== undefined && value.length > property.maxLength) {
        issues.push({
          path: [name],
          message: `String must contain at most ${property.maxLength} characters`,
        });
      }
      data[name] = value;
      continue;
    }

    if (property.type === "boolean") {
      if (typeof value !== "boolean") {
        issues.push({ path: [name], message: "Expected boolean" });
        continue;
      }
      if (!enumIncludes(property, value)) {
        issues.push({ path: [name], message: "Value is not in the allowed enum" });
      }
      data[name] = value;
      continue;
    }

    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push({ path: [name], message: `Expected finite ${property.type}` });
      continue;
    }
    if (property.type === "integer" && !Number.isSafeInteger(value)) {
      issues.push({ path: [name], message: "Expected safe integer" });
      continue;
    }
    if (!enumIncludes(property, value)) {
      issues.push({ path: [name], message: "Value is not in the allowed enum" });
    }
    if (property.minimum !== undefined && value < property.minimum) {
      issues.push({
        path: [name],
        message: `Number must be greater than or equal to ${property.minimum}`,
      });
    }
    if (property.maximum !== undefined && value > property.maximum) {
      issues.push({
        path: [name],
        message: `Number must be less than or equal to ${property.maximum}`,
      });
    }
    data[name] = value;
  }

  try {
    const serialized = JSON.stringify(data);
    if (new TextEncoder().encode(serialized).byteLength > INPUT_BYTES_MAX) {
      issues.push({ path: [], message: "Tool input must not exceed 64 KiB when serialized" });
    }
  } catch {
    issues.push({ path: [], message: "Tool input must be JSON-serializable" });
  }

  return issues.length === 0 ? { success: true, data } : { success: false, issues };
}
