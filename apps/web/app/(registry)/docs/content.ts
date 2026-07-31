export const RELEASE_ZIP_URL =
  "https://github.com/robertn702/webmcp-today/releases/latest/download/webmcp-today-chrome.zip";

export const DOWNLOAD_AND_EXTRACT = `mkdir -p "$HOME/Downloads/webmcp-today-extension"
curl -L "${RELEASE_ZIP_URL}" -o "$HOME/Downloads/webmcp-today-extension/webmcp-today-chrome.zip"
unzip -o "$HOME/Downloads/webmcp-today-extension/webmcp-today-chrome.zip" -d "$HOME/Downloads/webmcp-today-extension"`;

export const QUICKSTART_PROMPT = `Walk me through the verified WebMCP Today quickstart at https://webmcp.today/docs.

Your job:
- Perform the terminal commands and MCP configuration changes you can do safely.
- Preserve unrelated files and existing MCP servers.
- Download and extract the stable WebMCP Today release ZIP; do not clone or build the repository, or use a per-commit CI artifact.
- Pause whenever I must act in Chrome: loading the extracted extension folder, opening its popup, reviewing a package, or clicking Install.
- Use Chrome DevTools MCP to verify list_webmcp_tools and execute_webmcp_tool.
- Finish by calling reddit_subreddit_hot for r/webdev and showing five titles and permalinks.

Do not use DOM scraping, coordinate clicks, or evaluate_script as a substitute for a missing WebMCP tool. If a step fails, diagnose that step before continuing.`;

export const INSTALL_EXTENSION_PROMPT = `Install the latest WebMCP Today extension release for me.

Release ZIP: ${RELEASE_ZIP_URL}

Requirements:
- Download the ZIP and extract it into a dedicated local folder.
- Do not clone or build the repository, and do not use a per-commit CI artifact.
- Do not start the registry web app.
- Tell me the exact extracted folder to choose with chrome://extensions → Developer mode → Load unpacked. Chrome cannot install the ZIP directly.
- Tell me that WebMCP requires Chrome 149+ and chrome://flags/#enable-webmcp-testing (or an equivalent --enable-features launch flag).
- Remind me that off-store installs do not update automatically and Chrome may show a developer-mode warning at launch.
- Do not claim the extension is loaded yet.`;

export const START_CHROME = `open -na "Google Chrome" --args \\
  --remote-debugging-port=9222 \\
  --user-data-dir="$HOME/.chrome-webmcp" \\
  --enable-features=WebMCP,WebMCPTesting,DevToolsWebMCPSupport`;

export const MCP_CONFIG = `{
  "mcp": {
    "chrome-devtools": {
      "type": "local",
      "command": [
        "npx",
        "-y",
        "chrome-devtools-mcp@latest",
        "--browser-url=http://127.0.0.1:9222",
        "--category-experimental-webmcp"
      ]
    }
  }
}`;

export const CHROME_DEVTOOLS_MCP_PROMPT = `Configure Chrome DevTools MCP for WebMCP in this project.

Use this server command:
npx -y chrome-devtools-mcp@latest --browser-url=http://127.0.0.1:9222 --category-experimental-webmcp

Add it to the project's MCP configuration using the format this client expects. Do not replace unrelated MCP servers. Then tell me how to restart or reload the MCP client and how to verify that list_webmcp_tools and execute_webmcp_tool are available.`;

export const FIRST_TOOL_PROMPT = `Use the Chrome DevTools MCP server connected to my Chrome browser.

1. Navigate to https://www.reddit.com/r/webdev/.
2. List the page's WebMCP tools.
3. If reddit_subreddit_hot is missing, ask me to open the WebMCP Today extension popup, inspect the suggested Reddit package, and click Install. Wait for my confirmation, then reload Reddit and list the tools again.
4. Call reddit_subreddit_hot with subreddit "webdev" and limit 5.
5. Show me the returned titles and permalinks.

Do not use DOM scraping, coordinate clicks, or evaluate_script as a substitute for the WebMCP tool.`;

export const INSTALL_PACKAGE_PROMPT = `Install the WebMCP Today package for https://www.reddit.com/r/webdev/.

Use the Chrome browser connected through Chrome DevTools MCP.
1. Navigate to the Reddit URL.
2. Use list_webmcp_tools to check whether reddit_subreddit_hot is already registered.
3. If it is missing, ask me to open the WebMCP Today extension popup, inspect the Reddit suggestion, and click Install. You cannot click the browser toolbar extension icon for me, so wait for my confirmation.
4. Reload Reddit and verify that reddit_subreddit_hot appears.

Do not use DOM scraping or evaluate_script to imitate the missing tool.`;

export const CREATE_PACKAGE_PROMPT = `Create a WebMCP Today package for <TARGET URL>.

Work from https://github.com/robertn702/webmcp-today and read:
- https://webmcp.today/docs/package-format
- packages/curated-packages/data for real examples

Requirements:
- Use Chrome DevTools MCP to inspect the site's own same-origin HTTP requests.
- Use API execution only. Do not use DOM selectors or arbitrary page scripts.
- Start with one useful read-only tool and the smallest required input schema.
- Project the response with returns so the tool returns only what it promises.
- Save the result as webmcp-package.json in the repository root.
- Validate it from the repository root with:
  bun run --filter @robertn702/webmcp-today-schema build
  bun -e 'import { createPackageSchema } from "@robertn702/webmcp-today-schema"; const pkg = await Bun.file("webmcp-package.json").json(); console.log(createPackageSchema.parse(pkg));'
- Show me the final JSON, the exact request it makes, and a live read-only test result.

Do not publish yet. Stop after validation and the live test so I can review the package.`;

export const PUBLISH_PACKAGE_PROMPT = `Publish the reviewed webmcp-package.json to WebMCP Today.

Requirements:
- Read https://webmcp.today/terms and summarize the grant I am about to accept.
- Confirm webmcp-package.json declares version 1 and validate it against @robertn702/webmcp-today-schema.
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
