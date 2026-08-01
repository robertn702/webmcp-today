import { z } from "zod";

/** Wire protocol for the local MCP -> native host -> extension bridge. */
export const LOCAL_BRIDGE_PROTOCOL_VERSION = 1;
export const LOCAL_BRIDGE_NATIVE_HOST_NAME = "today.webmcp.bridge";

export type JsonValue =
  boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.null(),
    z.number(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const requestIdSchema = z.string().min(1).max(128);
const generationSchema = z.string().min(1).max(128);
const tabIdSchema = z.number().int().nonnegative();

export const localBridgeErrorCodeSchema = z.enum([
  "bridge-unavailable",
  "dispatch-failed",
  "execution-timeout",
  "invalid-response",
  "native-host-unavailable",
  "protocol-mismatch",
  "stale-tool",
  "tab-not-eligible",
  "tab-unavailable",
  "tool-error",
  "tool-not-found",
  "webmcp-unavailable",
]);

export const localBridgeErrorSchema = z.object({
  code: localBridgeErrorCodeSchema,
  message: z.string().min(1).max(2_000),
});

export const localBridgeDocumentSchema = z.object({
  generation: generationSchema,
  toolsGeneration: generationSchema,
  title: z.string().max(10_000),
  url: z.string().url().max(10_000),
});

/** Serializable projection of a live WebMCP tool. The actual tool stays in the page. */
export const localBridgeToolDescriptorSchema = z.object({
  name: z.string().min(1).max(1_000),
  description: z.string().max(100_000),
  // Chrome omits this serialized JSON Schema string for no-argument tools.
  inputSchema: z.string().min(1).max(100_000).optional(),
  origin: z.string().url().max(10_000),
  annotations: z.record(z.string(), jsonValueSchema).optional(),
});

export const localBridgeTabSchema = z.object({
  tabId: tabIdSchema,
  document: localBridgeDocumentSchema,
  toolCount: z.number().int().nonnegative(),
});

export const contentBridgeListToolsRequestSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("webmcp-today:local-bridge:list-tools"),
});

export const contentBridgeExecuteToolRequestSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("webmcp-today:local-bridge:execute-tool"),
  documentGeneration: generationSchema,
  toolsGeneration: generationSchema,
  toolName: z.string().min(1).max(1_000),
  toolOrigin: z.string().url().max(10_000),
  inputJson: z
    .string()
    .min(2)
    .max(1_000_000)
    .superRefine((input, ctx) => {
      try {
        const value: unknown = JSON.parse(input);
        if (
          typeof value !== "object" ||
          value === null ||
          Array.isArray(value) ||
          Object.getPrototypeOf(value) !== Object.prototype
        ) {
          ctx.addIssue({ code: "custom", message: "inputJson must encode an object" });
        }
      } catch {
        ctx.addIssue({ code: "custom", message: "inputJson must be valid JSON" });
      }
    }),
});

export const contentBridgeRequestSchema = z.discriminatedUnion("type", [
  contentBridgeListToolsRequestSchema,
  contentBridgeExecuteToolRequestSchema,
]);

export const contentBridgeToolsResponseSchema = z.object({
  ok: z.literal(true),
  document: localBridgeDocumentSchema,
  tools: z.array(localBridgeToolDescriptorSchema),
});

export const contentBridgeToolResultResponseSchema = z.object({
  ok: z.literal(true),
  document: localBridgeDocumentSchema,
  result: jsonValueSchema.nullable(),
});

export const contentBridgeErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: localBridgeErrorSchema,
});

export const contentBridgeResponseSchema = z.union([
  contentBridgeToolsResponseSchema,
  contentBridgeToolResultResponseSchema,
  contentBridgeErrorResponseSchema,
]);

export const localBridgeListTabsRequestSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("list-tabs"),
  requestId: requestIdSchema,
});

export const localBridgeListToolsRequestSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("list-tools"),
  requestId: requestIdSchema,
  tabId: tabIdSchema,
});

export const localBridgeExecuteToolRequestSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("execute-tool"),
  requestId: requestIdSchema,
  tabId: tabIdSchema,
  documentGeneration: generationSchema,
  toolsGeneration: generationSchema,
  toolName: z.string().min(1).max(1_000),
  toolOrigin: z.string().url().max(10_000),
  inputJson: contentBridgeExecuteToolRequestSchema.shape.inputJson,
});

export const localBridgeRequestSchema = z.discriminatedUnion("type", [
  localBridgeListTabsRequestSchema,
  localBridgeListToolsRequestSchema,
  localBridgeExecuteToolRequestSchema,
]);

export const localBridgeTabsResponseSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("tabs"),
  requestId: requestIdSchema,
  tabs: z.array(localBridgeTabSchema),
});

export const localBridgeToolsResponseSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("tools"),
  requestId: requestIdSchema,
  tabId: tabIdSchema,
  document: localBridgeDocumentSchema,
  tools: z.array(localBridgeToolDescriptorSchema),
});

export const localBridgeToolResultResponseSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("tool-result"),
  requestId: requestIdSchema,
  tabId: tabIdSchema,
  document: localBridgeDocumentSchema,
  result: jsonValueSchema.nullable(),
});

export const localBridgeErrorResponseSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("error"),
  requestId: requestIdSchema,
  error: localBridgeErrorSchema,
});

export const localBridgeResponseSchema = z.discriminatedUnion("type", [
  localBridgeTabsResponseSchema,
  localBridgeToolsResponseSchema,
  localBridgeToolResultResponseSchema,
  localBridgeErrorResponseSchema,
]);

export const localBridgeSocketHelloSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("socket-hello"),
  role: z.literal("mcp-server"),
  secret: z.string().min(32).max(512),
});

export const localBridgeSocketAcceptedSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("socket-accepted"),
});

/** Sent before the host writes an execute request to Chrome. */
export const localBridgeSocketDispatchingSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("request-dispatching"),
  requestId: requestIdSchema,
});

/** Confirms that the MCP client processed the pre-dispatch marker. */
export const localBridgeSocketDispatchAckSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("dispatch-ack"),
  requestId: requestIdSchema,
});

export const localBridgeReadySchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  type: z.literal("bridge-ready"),
});

export const localBridgeConfigurationSchema = z.object({
  v: z.literal(LOCAL_BRIDGE_PROTOCOL_VERSION),
  socketPath: z.string().min(1).max(4_096),
  secret: z.string().min(32).max(512),
});

export type ContentBridgeRequest = z.infer<typeof contentBridgeRequestSchema>;
export type ContentBridgeResponse = z.infer<typeof contentBridgeResponseSchema>;
export type LocalBridgeDocument = z.infer<typeof localBridgeDocumentSchema>;
export type LocalBridgeError = z.infer<typeof localBridgeErrorSchema>;
export type LocalBridgeRequest = z.infer<typeof localBridgeRequestSchema>;
export type LocalBridgeResponse = z.infer<typeof localBridgeResponseSchema>;
export type LocalBridgeToolDescriptor = z.infer<typeof localBridgeToolDescriptorSchema>;
export type LocalBridgeConfiguration = z.infer<typeof localBridgeConfigurationSchema>;
