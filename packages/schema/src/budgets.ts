// Character budgets from Chrome's WebMCP guidance
// (https://developer.chrome.com/docs/ai/webmcp).

export const TOOL_NAME_MAX = 30;
export const TOOL_DESCRIPTION_MAX = 500;
export const PARAM_DESCRIPTION_MAX = 150;
/** Executors should truncate tool output to this many characters. */
export const TOOL_OUTPUT_MAX = 1500;

/** Current config format engine version. Bump when the format changes shape. */
export const ENGINE_VERSION = 1;
