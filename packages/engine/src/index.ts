// The engine's public surface, named explicitly rather than `export *`: this is
// a published package, so anything re-exported here is API we owe compatibility
// on. The rest of api-executor.ts (buildRequest, handleResponse, interpolateDeep,
// getByPath, isNonEmpty, applyProjection, resolveDocument, clearAuthTokenCache)
// stays exported from its own module for the unit tests, which import by path —
// internal, not shipped.

export { executeApiTool } from "./api-executor.js";
export { requiredEngineLevel, supportsPackageEngine } from "./engine-gate.js";
export type { McpResult, McpTextContent } from "./result.js";
