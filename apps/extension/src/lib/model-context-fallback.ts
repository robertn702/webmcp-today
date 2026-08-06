import type {
  McpResult,
  ModelContextLike,
  ToolConsumerModelContextLike,
  ToolRegistration,
} from "./model-context.js";

interface RegisteredTool {
  descriptor: ToolRegistration;
  signal?: AbortSignal;
}

class FallbackModelContext
  extends EventTarget
  implements ModelContextLike, ToolConsumerModelContextLike
{
  private readonly tools = new Map<string, RegisteredTool>();

  async registerTool(
    descriptor: ToolRegistration,
    options?: { signal?: AbortSignal },
  ): Promise<void> {
    if (options?.signal?.aborted) {
      throw new DOMException("WebMCP tool registration was aborted.", "AbortError");
    }
    if (!documentAllowsTools()) {
      throw new DOMException(
        "WebMCP is disallowed by Permissions-Policy on this page",
        "SecurityError",
      );
    }
    if (this.tools.has(descriptor.name)) {
      throw new DOMException(
        `A tool named "${descriptor.name}" is already registered.`,
        "InvalidStateError",
      );
    }

    const registered = { descriptor, ...(options?.signal ? { signal: options.signal } : {}) };
    this.tools.set(descriptor.name, registered);

    options?.signal?.addEventListener(
      "abort",
      () => {
        if (this.tools.get(descriptor.name) !== registered) return;
        this.tools.delete(descriptor.name);
        this.dispatchEvent(new Event("toolchange"));
      },
      { once: true },
    );
    this.dispatchEvent(new Event("toolchange"));
  }

  async getTools(): Promise<unknown[]> {
    return Array.from(this.tools.values(), ({ descriptor }) => ({
      name: descriptor.name,
      description: descriptor.description,
      inputSchema: JSON.stringify(descriptor.inputSchema),
      origin: location.origin,
      ...(descriptor.annotations ? { annotations: descriptor.annotations } : {}),
    }));
  }

  async executeTool(tool: unknown, inputJson: string): Promise<McpResult> {
    const name = toolName(tool);
    if (!name) {
      throw new DOMException("The selected WebMCP tool is invalid.", "InvalidStateError");
    }

    const registered = this.tools.get(name);
    if (!registered) {
      throw new DOMException(
        "The selected WebMCP tool is no longer registered.",
        "InvalidStateError",
      );
    }
    return registered.descriptor.execute(JSON.parse(inputJson));
  }
}

let fallbackModelContext: FallbackModelContext | undefined;

/** A document-local WebMCP implementation for the extension's provider/consumer loop. */
export function getOrCreateFallbackModelContext(): ModelContextLike & ToolConsumerModelContextLike {
  fallbackModelContext ??= new FallbackModelContext();
  return fallbackModelContext;
}

function toolName(tool: unknown): string | undefined {
  if (typeof tool !== "object" || tool === null) return undefined;
  const name = Reflect.get(tool, "name");
  return typeof name === "string" ? name : undefined;
}

/**
 * Unknown/missing policy APIs are intentionally ignored: older Chrome versions
 * cannot report WebMCP policy while the native API is unavailable.
 */
function documentAllowsTools(): boolean {
  const policy = Reflect.get(document, "permissionsPolicy");
  if (typeof policy !== "object" || policy === null) return true;
  const allowsFeature = Reflect.get(policy, "allowsFeature");
  if (typeof allowsFeature !== "function") return true;
  try {
    if (allowsFeature.call(policy, "tools") !== false) return true;
    // WebMCP-disabled Chromium returns false for an unknown `tools` policy.
    // Only treat it as a denial if the policy API also recognizes the feature.
    const features = Reflect.get(policy, "features");
    if (typeof features !== "function") return true;
    const supportedFeatures = features.call(policy);
    return !Array.isArray(supportedFeatures) || !supportedFeatures.includes("tools");
  } catch {
    return true;
  }
}
