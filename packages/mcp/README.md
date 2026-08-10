# WebMCP Today MCP Bridge

[`@webmcp-today/mcp-bridge`](https://www.npmjs.com/package/@webmcp-today/mcp-bridge)
is an MCP server for [WebMCP Today](https://webmcp.today): a registry of packages
that add WebMCP tools to supported sites through the WebMCP Today browser extension.

It lets an MCP client browse and publish registry packages, manage account-level
package pins, and—when the optional local browser bridge is installed—discover and
invoke live WebMCP tools in the user's selected browser tab.

## Install and configure

Requires Node.js 20 or later. Configure any stdio-capable MCP client to run the
package with `npx`:

```json
{
  "mcpServers": {
    "webmcp-today": {
      "command": "npx",
      "args": ["--yes", "@webmcp-today/mcp-bridge@0.2.0"]
    }
  }
}
```

The default registry is `https://webmcp.today`. Set `WEBMCP_TODAY_API_URL` only
when using another compatible registry endpoint.

### Registry API key (optional)

Public package discovery does not need credentials. Set `WEBMCP_TODAY_API_KEY`
in the MCP server environment to use authenticated account and publisher actions,
including package pins, publishing, and package metadata updates. Create an API key
in [WebMCP Today settings](https://webmcp.today/settings/security); do not put it
in prompts, package definitions, or source control.

```json
{
  "mcpServers": {
    "webmcp-today": {
      "command": "npx",
      "args": ["--yes", "@webmcp-today/mcp-bridge@0.2.0"],
      "env": {
        "WEBMCP_TODAY_API_KEY": "<your-api-key>"
      }
    }
  }
}
```

## Capabilities

The server provides tools in these categories:

- **Registry discovery** — look up packages for a URL, browse packages, retrieve
  a package at its latest version, and view registry statistics.
- **Account and publishing** — inspect and manage account-level package pins;
  publish packages and append versions; update package metadata. These actions
  require an API key. An account pin does **not** install a package in the browser;
  the returned install link hands that explicit browser-consent step to the user.
- **Live WebMCP bridge** — list and focus the user-selected visible Chrome or Brave tab, list its live
  tools, and execute a selected tool using the document and tool-list generations
  returned by discovery.
- **Bridge administration** — install, inspect, and remove the first-party native
  bridge on supported macOS browsers.

## Live browser bridge

The live bridge is optional. It requires the WebMCP Today extension and the
first-party native host setup on **macOS Chrome or Brave**. After configuring the
MCP server, call `setup_webmcp_bridge` with explicit approval, for example:

```json
{ "browser": "chrome", "confirm": true }
```

Setup copies the bundled native host under `~/.config/webmcp-today` and writes only
this bridge's native-messaging manifest(s) in the browser's Application Support
directories. Brave writes both its own manifest and a Chrome-compatibility manifest.
It runs under Node 20 or later or Bun. Use `get_webmcp_bridge_status` to inspect the
installation without exposing the bridge secret.

The bridge only operates on the user-selected active, visible Chrome or Brave tab.
It does not enable WebMCP, run arbitrary JavaScript, proxy Chrome DevTools Protocol,
or expose an HTTP port. Registry-injected tools make same-origin page requests with
the page's authenticated cookies, so they can act as the signed-in site account. A
page can still refuse injected WebMCP tools, and changing a page or its tools between
discovery and execution requires discovery again.

The extension's local fallback can serve tools through this bridge without the
current WebMCP testing flag. That flag is still required for Chrome's native agent to
see injected tools in the current browser preview.

### Confirmations and retries

- Registry-injected tools marked as destructive retain their page-level
  `window.confirm` prompt; approve it in the selected tab.
- `setup_webmcp_bridge` and `uninstall_webmcp_bridge` make no filesystem changes
  until called with `confirm: true`.
- On `execution-timeout`, the browser may have completed the tool call: verify the
  result before retrying. `dispatch-failed` means the call was not dispatched and
  can be retried.
- Removing a Brave installation intentionally leaves its Chrome compatibility
  manifest. Follow the tool's reported instruction to run the confirmed Chrome
  uninstall after closing both browsers before treating the bridge as fully removed.

## Development

For repository development, install dependencies and run the package tests:

```bash
bun install
bun run --filter @webmcp-today/mcp-bridge test
```

## Links

- [WebMCP Today](https://webmcp.today)
- [Source code](https://github.com/robertn702/webmcp-today/tree/main/packages/mcp)
- [Issues](https://github.com/robertn702/webmcp-today/issues)
- [MIT License](./LICENSE)
