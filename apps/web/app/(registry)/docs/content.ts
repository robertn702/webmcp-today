export const EXTENSION_RELEASE_URL =
  "https://github.com/robertn702/webmcp-today/releases/latest/download/webmcp-today-chrome.zip";
export const REDDIT_DEMO_URL = "https://www.reddit.com/r/webdev/";
export const REDDIT_PACKAGE_DOMAIN = "reddit.com";
export const FIRST_TOOL_NAME = "reddit_subreddit_hot";
export const REDDIT_TOOL_COUNT = 6;

export const BUILD_LOCAL_BRIDGE = `cd /absolute/path/to/webmcp-today
bunx turbo run build --filter="@webmcp-today/mcp-bridge..."`;

export const MCP_CONFIG = `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "webmcp-today": {
      "type": "local",
      "command": ["node", "/absolute/path/to/webmcp-today/packages/mcp/dist/index.js"]
    }
  }
}`;

export const QUICKSTART_PROMPT = `Walk me through the WebMCP Today bridge quickstart at https://webmcp.today/docs/quickstart.

Your job:
- Preserve unrelated MCP servers and configuration.
- Download and extract the extension ZIP from ${EXTENSION_RELEASE_URL}. Do not build the extension from source.
- Pause for browser-only actions: enabling Developer mode, choosing Load unpacked, and selecting the extracted extension folder; enabling WebMCP if the readiness check says it is unavailable; opening and selecting https://www.reddit.com/r/webdev/ in my normal browser; and reviewing/installing the Reddit package from the extension popup.
- Configure the first-party WebMCP Today MCP server from the local repository build.
- After restarting the MCP client, call setup_webmcp_bridge with browser "chrome" and confirm: true. Use browser "brave" for Brave. This is the only bridge-install step; do not run a manual installer command.
- Call get_webmcp_bridge_status after setup. If it is not ready, diagnose its returned bridge-owned paths and permissions before proceeding.
- Use list_connected_webmcp_tabs, list_webmcp_tools, and execute_webmcp_tool for the verification.
- After I confirm the selected Reddit tab is open, use it. If reddit_subreddit_hot is missing, ask me to install the Reddit package in the extension popup and wait for confirmation.
- Call reddit_subreddit_hot with {"subreddit":"webdev","limit":5} and show five titles and permalinks.

Do not substitute DOM scraping, coordinate clicks, or arbitrary page execution for a missing WebMCP tool. If a step fails, diagnose that step before continuing.`;

export const FIRST_TOOL_PROMPT = `Use the WebMCP Today MCP server to verify a live, read-only Reddit call.

1. I have selected the normal browser tab at ${REDDIT_DEMO_URL}.
2. Call list_connected_webmcp_tabs, then list_webmcp_tools for that tab.
3. If ${FIRST_TOOL_NAME} is missing, ask me to open the WebMCP Today extension popup, inspect the suggested Reddit package, and click Install. Wait for my confirmation, then list tools again in the same tab.
4. Call ${FIRST_TOOL_NAME} with {"subreddit":"webdev","limit":5}, using the document and tool-list generations returned by list_webmcp_tools.
5. Show five returned titles and permalinks.

Do not substitute DOM scraping or arbitrary page execution for the missing tool.`;

export const CREATE_PACKAGE_PROMPT = `Create a WebMCP Today package for <TARGET URL>.

Read https://webmcp.today/docs/package-format and the examples in packages/curated-packages/data.

Requirements:
- Use API execution only. Do not use DOM selectors or arbitrary page scripts.
- Start with one useful read-only tool and the smallest required input schema.
- Base the package on the site's documented or directly observed same-origin HTTP API.
- Project the response with returns so the tool returns only what it promises.
- Save the result as webmcp-package.json in the repository root.
- Validate it from the repository root with:
  bun run --filter @webmcp-today/schema build
  bun -e 'import { createPackageSchema } from "@webmcp-today/schema"; const pkg = await Bun.file("webmcp-package.json").json(); console.log(createPackageSchema.parse(pkg));'
- Show the final JSON, the exact request it makes, and a live read-only test result.

Do not publish yet. Stop after validation and the live test so I can review the package.`;

export const PUBLISH_PACKAGE_PROMPT = `Publish the reviewed webmcp-package.json to WebMCP Today.

Requirements:
- Read https://webmcp.today/terms and summarize the grant I am about to accept.
- Confirm webmcp-package.json declares version 1 and validate it against @webmcp-today/schema.
- Require WEBMCP_TODAY_API_KEY to be present in the environment. Never print the key.
- Show me the target URL and package title, then ask for confirmation before the POST.
- On approval, POST webmcp-package.json to https://webmcp.today/api/packages with Authorization: Bearer $WEBMCP_TODAY_API_KEY.
- Report the HTTP status, package id, Location header, Link terms header, and registry page URL.
- Stop on any non-201 response; do not retry a write automatically.`;

export const PUBLISH_COMMAND = `curl --config - <<EOF
url = "https://webmcp.today/api/packages"
request = "POST"
header = "Authorization: Bearer $WEBMCP_TODAY_API_KEY"
header = "Content-Type: application/json"
data-binary = "@webmcp-package.json"
EOF`;
