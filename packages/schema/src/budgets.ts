// Publish-time metadata character budgets from Chrome's WebMCP guidance
// (https://developer.chrome.com/docs/ai/webmcp). These caps are enforced.
// There is no tool-output cap: the 1.5K TOOL_OUTPUT_MAX was removed for v1
// (model-dependent — Chrome's 1.5K is guidance, not enforcement). Revisit when
// we design output-budget customization — see docs/DECISIONS.md 2026-07-24.

export const TOOL_NAME_MAX = 30;
export const TOOL_DESCRIPTION_MAX = 500;
export const PARAM_DESCRIPTION_MAX = 150;

/** Current package format engine version — a capability level compared with
 *  plain `>=` against a version's `minEngine` (docs/DECISIONS.md 2026-07-24).
 *
 *  PEGGED AT 1 FOR PRE-RELEASE. Do not bump it when the format changes shape.
 *  The number exists so an older extension build refuses content it cannot run,
 *  and pre-release there are no older builds and no published packages — so a
 *  bump protects nobody and just strands the one config that has to move with
 *  it. The format is still changing freely; that is the point. Start bumping at
 *  the first release, from 2. */
export const ENGINE_VERSION = 1;
