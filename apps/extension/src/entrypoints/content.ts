import { defineContentScript } from "wxt/utils/define-content-script";
import { ENGINE_VERSION } from "@robertn702/webmcp-cafe-schema";
import { executeApiTool } from "../lib/api-executor.js";
import { getConfigsForUrl } from "../lib/configs.js";
import { requiredEngineLevel, supportsConfigEngine } from "../lib/engine-gate.js";
import { executeTool } from "../lib/executor.js";
import { getModelContext, type McpResult } from "../lib/model-context.js";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    void registerTools();
  },
});

type ToolExecute = (params: Record<string, unknown>) => Promise<McpResult>;

async function registerTools(): Promise<void> {
  const mc = getModelContext();
  if (!mc) return;

  const configs = await getConfigsForUrl(window.location.href);
  if (configs.length === 0) return;

  // Site-declared declarative tools — skip ours on name collision.
  const declarativeNames = new Set<string>();
  for (const form of document.querySelectorAll("form[toolname]")) {
    const name = form.getAttribute("toolname");
    if (name) declarativeNames.add(name);
  }

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

      try {
        // Promise-based in the 2026 draft; rejects on duplicate names, which
        // also covers collisions with imperatively site-registered tools.
        await mc.registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          ...(tool.annotations ? { annotations: tool.annotations } : {}),
          execute,
        });
        console.info(`[webmcp-cafe] Registered tool "${tool.name}"`);
      } catch (err) {
        console.warn(
          `[webmcp-cafe] Skipping tool "${tool.name}" — registerTool rejected (name collision with a site-registered tool?):`,
          err,
        );
      }
    }
  }
}
