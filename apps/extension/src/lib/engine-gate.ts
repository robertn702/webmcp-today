import { ENGINE_VERSION } from "@robertn702/webmcp-cafe-schema";

// minEngine enforcement. A version's `minEngine` is the capability level its
// content requires; the executor's own level is ENGINE_VERSION (schema budgets).
// The registry serves each config AS a version, so the gate is per-config: a
// config needing an engine newer than this build must be skipped whole, never
// registering tools this executor can't run correctly. See the "minEngine bump
// policy" open question in docs/api-execution-model.md.

/** A config version's engine floor. Configs without `minEngine` target the base
 *  level (1) — the level that predates the field. */
export function requiredEngineLevel(config: { minEngine?: number }): number {
  return config.minEngine ?? 1;
}

/** Whether this executor can run the given config version. */
export function supportsConfigEngine(
  config: { minEngine?: number },
  engineVersion: number = ENGINE_VERSION,
): boolean {
  return requiredEngineLevel(config) <= engineVersion;
}
