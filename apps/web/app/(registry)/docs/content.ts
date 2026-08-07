export const EXTENSION_RELEASE_URL =
  "https://github.com/robertn702/webmcp-today/releases/latest/download/webmcp-today-extension.zip";
export const EXTENSION_RELEASES_URL = "https://github.com/robertn702/webmcp-today/releases/latest";
export const REDDIT_DEMO_URL = "https://www.reddit.com/r/webdev/";
export const REDDIT_PACKAGE_DOMAIN = "reddit.com";
export const FIRST_TOOL_NAME = "reddit_subreddit_hot";
export const REDDIT_TOOL_COUNT = 6;

export const MCP_BRIDGE_PACKAGE = "@webmcp-today/mcp-bridge@0.1.2";
export const MCP_BRIDGE_NODE_ISSUE_URL = "https://github.com/robertn702/webmcp-today/issues/127";
export const DOWNLOAD_EXTENSION = `curl -L ${EXTENSION_RELEASE_URL} -o ~/Downloads/webmcp-today-extension.zip
unzip ~/Downloads/webmcp-today-extension.zip -d ~/Downloads/webmcp-today-extension`;

export const MCP_CLIENT_CONFIGS = [
  {
    id: "opencode",
    name: "OpenCode",
    location: "opencode.json",
    instruction: "Add this to",
    format: "json",
    configuration: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "webmcp-today": {
      "type": "local",
      "command": ["npx", "--yes", "${MCP_BRIDGE_PACKAGE}"]
    }
  }
}`,
  },
  {
    id: "claude-code",
    name: "Claude Code",
    location: "your terminal",
    instruction: "Run this once in your terminal:",
    format: "sh",
    configuration: `claude mcp add --transport stdio --scope user webmcp-today -- npx --yes ${MCP_BRIDGE_PACKAGE}`,
  },
  {
    id: "codex",
    name: "Codex",
    location: "~/.codex/config.toml",
    instruction: "Add this to",
    format: "toml",
    configuration: `[mcp_servers.webmcp-today]
command = "npx"
args = ["--yes", "${MCP_BRIDGE_PACKAGE}"]`,
  },
  {
    id: "cursor",
    name: "Cursor",
    location: "~/.cursor/mcp.json",
    instruction: "Add this to",
    format: "json",
    configuration: `{
  "mcpServers": {
    "webmcp-today": {
      "type": "stdio",
      "command": "npx",
      "args": ["--yes", "${MCP_BRIDGE_PACKAGE}"]
    }
  }
}`,
  },
  {
    id: "vs-code",
    name: "VS Code",
    location: ".vscode/mcp.json",
    instruction: "Add this to",
    format: "json",
    configuration: `{
  "servers": {
    "webmcp-today": {
      "type": "stdio",
      "command": "npx",
      "args": ["--yes", "${MCP_BRIDGE_PACKAGE}"]
    }
  }
}`,
  },
] as const;

export const MCP_CLIENT_CONFIG_PROMPT = MCP_CLIENT_CONFIGS.map(
  (client) => `### ${client.name} (${client.location})

\`\`\`${client.format}
${client.configuration}
\`\`\``,
).join("\n\n");

export const QUICKSTART_PROMPT = `# WebMCP Today bridge quickstart

Help me make a first live, read-only WebMCP tool call. Work through these instructions in order and diagnose a failed step before continuing.

## Prerequisites

- I need macOS, Chrome or Brave, and Node 20 or newer.
- Preserve unrelated MCP servers and configuration.
- The WebMCP Today extension, bridge, and package format are in public beta.

## 1. Check the browser and load the extension

1. Have me open https://webmcp.today/docs/quickstart in the normal Chrome or Brave browser I will use.
2. Ask me to use its browser-readiness check. It should report the WebMCP Today extension as connected; no WebMCP testing flag is needed for this path — the extension's built-in fallback registers tools without it, and the flag only matters for Chrome's native agent.
3. Download and extract the extension ZIP. Do not build the extension from source:

\`\`\`sh
${DOWNLOAD_EXTENSION}
\`\`\`
   For a manual download, use ${EXTENSION_RELEASES_URL}.
4. Pause for me to enable Developer mode, choose Load unpacked, and select the extracted extension folder. The extension must remain enabled in the browser holding the target tab.

## 2. Install and configure the bridge

1. Add a local stdio MCP server named \`webmcp-today\` that runs \`npx --yes ${MCP_BRIDGE_PACKAGE}\` to the configuration for the client I use. This downloads the pinned bridge on demand without a global install. Use \`npx\`, not \`bunx\`, because bridge setup requires Node; see ${MCP_BRIDGE_NODE_ISSUE_URL}. Preserve my other MCP servers.

${MCP_CLIENT_CONFIG_PROMPT}

2. Have me restart or reload that MCP client.
3. Call \`setup_webmcp_bridge\` with \`{"browser":"chrome","confirm":true}\`. Use \`"brave"\` instead of \`"chrome"\` if I use Brave. This confirmation-gated tool is the only bridge-install step; do not run a manual installer command.
4. Call \`get_webmcp_bridge_status\`. If it is not ready, diagnose the returned bridge-owned paths and permissions before proceeding.

## 3. Install Reddit in the selected tab

1. Pause for me to open and select ${REDDIT_DEMO_URL} in my normal browser.
2. Pause for me to open the WebMCP Today extension popup, inspect the suggested Reddit package, and click Install. This is a browser-owned consent action that I must perform.

## 4. Verify the live tool call

1. Call \`list_connected_webmcp_tabs\`, then \`list_webmcp_tools\` for the selected Reddit tab.
2. If \`${FIRST_TOOL_NAME}\` is missing, ask me to install or repair the Reddit package in the extension popup and wait for confirmation before listing tools again.
3. Call \`execute_webmcp_tool\` with the selected tab ID; the document and tool-list generations; the \`${FIRST_TOOL_NAME}\` tool name and origin; and \`{"subreddit":"webdev","limit":5}\` as input.
4. Show the five returned titles and permalinks.

Do not substitute DOM scraping, coordinate clicks, or arbitrary page execution for a missing WebMCP tool.`;

export const FIRST_TOOL_PROMPT = `Use the WebMCP Today MCP server to verify a live, read-only Reddit call.

1. I have selected the normal browser tab at ${REDDIT_DEMO_URL}.
2. Call list_connected_webmcp_tabs, then list_webmcp_tools for that tab.
3. If ${FIRST_TOOL_NAME} is missing, ask me to open the WebMCP Today extension popup, inspect the suggested Reddit package, and click Install. Wait for my confirmation, then list tools again in the same tab.
4. Call execute_webmcp_tool with the tab id, document generation, tools generation, and ${FIRST_TOOL_NAME} origin returned by list_webmcp_tools. Pass ${FIRST_TOOL_NAME} as toolName and {"subreddit":"webdev","limit":5} as input.
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
