import { ENGINE_VERSION } from "@robertn702/webmcp-cafe-schema";

// minEngine enforcement. A version's `minEngine` is the capability level its
// content requires; the executor's own level is ENGINE_VERSION (schema budgets).
// The registry serves each package AS a version, so the gate is per-package: a
// package needing an engine newer than this build must be skipped whole, never
// registering tools this executor can't run correctly. See the "minEngine bump
// policy" open question in docs/api-execution-model.md.

/** A package version's engine floor. Packages without `minEngine` target the base
 *  level (1) — the level that predates the field. */
export function requiredEngineLevel(pkg: { minEngine?: number }): number {
  return pkg.minEngine ?? 1;
}

/** Whether this executor can run the given package version. */
export function supportsPackageEngine(
  pkg: { minEngine?: number },
  engineVersion: number = ENGINE_VERSION,
): boolean {
  return requiredEngineLevel(pkg) <= engineVersion;
}
