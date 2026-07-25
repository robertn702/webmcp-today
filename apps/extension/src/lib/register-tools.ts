import { ENGINE_VERSION, type CreateConfigInput } from "@robertn702/webmcp-cafe-schema";
import { executeApiTool } from "./api-executor.js";
import { requiredEngineLevel, supportsConfigEngine } from "./engine-gate.js";
import { executeTool } from "./executor.js";
import type { McpResult, ModelContextLike } from "./model-context.js";
import { WEBMCP_FLAG_URL, type PageStatus } from "./status.js";

type ToolExecute = (params: Record<string, unknown>) => Promise<McpResult>;

/** Seams the content script fills in; tests pass fakes. */
export interface RegistrationDeps {
  /** Configs matching the URL — registry first, bundled fallback. */
  loadConfigs: (url: string) => Promise<CreateConfigInput[]>;
  /** Chrome's WebMCP entry point, or undefined when the API is unavailable. */
  getModelContext: () => ModelContextLike | undefined;
  /** Tool names the site declared itself (`form[toolname]`) — ours yield to them. */
  siteDeclaredToolNames: () => Set<string>;
  /** Surfaces the pass outcome on the action badge + popup. */
  reportStatus: (status: PageStatus) => void;
}

/**
 * One registration pass for `url`. Every tool is registered with `signal`, so
 * aborting it (on the next navigation) unregisters everything this pass added.
 *
 * Configs are looked up *before* WebMCP is probed on purpose: a missing
 * `document.modelContext` is only worth telling the user about on a page we
 * actually have tools for — probing first would warn on every page on the
 * internet.
 */
export async function runRegistrationPass(
  url: string,
  signal: AbortSignal,
  deps: RegistrationDeps,
): Promise<void> {
  const configs = await deps.loadConfigs(url);
  // Navigated away while the lookup was in flight — the newer pass owns the
  // status, so say nothing.
  if (signal.aborted) return;

  if (configs.length === 0) {
    deps.reportStatus({ kind: "no-configs" });
    return;
  }

  const mc = deps.getModelContext();
  if (!mc) {
    console.warn(
      `[webmcp-cafe] ${configs.length} config(s) match this page, but Chrome's WebMCP API is unavailable, so no tools were registered.\n` +
        `Enable it: open ${WEBMCP_FLAG_URL}, set "WebMCP for testing" to Enabled, then relaunch Chrome. Needs Chrome 149+.`,
    );
    deps.reportStatus({ kind: "webmcp-unavailable", configCount: configs.length });
    return;
  }

  const declarativeNames = deps.siteDeclaredToolNames();
  const registered: string[] = [];
  const seen = new Set<string>();

  for (const config of configs) {
    // Refuse the whole config when it needs an engine newer than this build — a
    // too-new config must not silently register inert/mis-executed tools.
    if (!supportsConfigEngine(config)) {
      console.warn(
        `[webmcp-cafe] Skipping config "${config.title}" — needs engine level ${requiredEngineLevel(config)}, but this extension is level ${ENGINE_VERSION}. Update the extension.`,
      );
      continue;
    }

    for (const tool of config.tools) {
      const execution = tool.execution;
      if (!execution) continue;

      // Resolve an execute() for the supported execution modes; skip + warn on
      // anything not yet supported.
      let execute: ToolExecute | undefined;
      if (execution.mode === "dom") {
        execute = (params) => executeTool(tool.name, execution, params, tool.annotations);
      } else if (execution.mode === "api") {
        const api = config.api;
        const endpoint = api?.endpoints[execution.endpoint];
        if (!api || !endpoint) {
          console.warn(
            `[webmcp-cafe] Skipping tool "${tool.name}" — api endpoint "${execution.endpoint}" is missing from the config's api block.`,
          );
          continue;
        }
        const endpointName = execution.endpoint;
        execute = (params) =>
          executeApiTool(tool.name, api, endpointName, params, tool.annotations);
      }
      if (!execute) {
        console.warn(
          `[webmcp-cafe] Skipping tool "${tool.name}" — execution mode is not supported yet.`,
        );
        continue;
      }

      if (seen.has(tool.name)) continue;
      if (declarativeNames.has(tool.name)) {
        console.warn(
          `[webmcp-cafe] Skipping tool "${tool.name}" — collides with a site-declared tool`,
        );
        continue;
      }
      seen.add(tool.name);

      if (signal.aborted) return;
      try {
        // Promise-based in the 2026 draft; rejects on duplicate names, which
        // also covers collisions with imperatively site-registered tools.
        // `signal` ties the tool's lifetime to this pass.
        await mc.registerTool(
          {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            ...(tool.annotations ? { annotations: tool.annotations } : {}),
            execute,
          },
          { signal },
        );
        registered.push(tool.name);
        console.info(`[webmcp-cafe] Registered tool "${tool.name}"`);
      } catch (err) {
        console.warn(
          `[webmcp-cafe] Skipping tool "${tool.name}" — registerTool rejected (name collision with a site-registered tool?):`,
          err,
        );
      }
    }
  }

  deps.reportStatus({ kind: "registered", toolNames: registered });
}
