# WebMCP Today MCP bridge

`webmcp-today-mcp` exposes registry operations and three browser bridge tools:

- `list_connected_webmcp_tabs`
- `list_webmcp_tools`
- `execute_webmcp_tool`

The bridge calls WebMCP's consumer API in the existing extension content script.
It does not enable WebMCP, run JavaScript, proxy CDP, read cookies, or expose an
HTTP port. Package API execution stays inside the page content script; a
destructive package tool still blocks on the browser's `window.confirm`.

## macOS development setup

1. Build the MCP package and its schema dependency:

   ```bash
   bunx turbo run build --filter="@robertn702/webmcp-today-mcp..."
   ```

2. Build/load the extension. Local builds use the fixed development extension
   ID `peaiababjjehplphfkhefdlgefaaemkl`; reload an existing unpacked install
   after the first build that includes this key.

3. Install the host manifest. It defaults to the development extension ID and
   writes only per-user native-messaging manifests, never a wildcard origin:

   ```bash
   # Chrome
   node packages/mcp/bin/install-native-host.mjs

   # Brave
   node packages/mcp/bin/install-native-host.mjs --browser=brave
   ```

   Pass an explicit extension ID only for a non-development identity, such as
   a release build: `node packages/mcp/bin/install-native-host.mjs <id> --browser=brave`.
   Brave installs to both its documented product directory and Chrome's macOS
   compatibility directory. Brave 151 can retain the Chrome native-messaging
   lookup root even while its profile data uses `BraveSoftware/Brave-Browser`.

4. Start the MCP server with `bun packages/mcp/dist/index.js`, select a normal
   Chrome tab, and call `list_connected_webmcp_tabs`. Confirm that Chrome can
   launch the installed host with this call before relying on it in an MCP client.

Chrome still needs WebMCP enabled (`chrome://flags/#enable-webmcp-testing` in
the current preview). This path removes Chrome DevTools MCP, port 9222, and the
remote-debugging launch argument; it does not change WebMCP browser support.

## Packaging remaining

This is a macOS-only Node development host, not a signed installer. The installer
writes a user-owned executable wrapper containing Node's absolute path so Chrome
or Brave can launch it from Finder or the Dock. Native-host manifests and their
wrappers are readable/executable (`0644`/`0755`) because Chromium's sandboxed
native-messaging discovery otherwise treats them as unavailable; the private
socket configuration and its secret remain user-only (`0600`). Re-run the
installer after upgrading Node.
A production
release still needs a signed/notarized native executable, installers for Edge,
Brave, Linux, and Windows registry entries, exact release/dev extension IDs,
and a Windows named-pipe implementation. The current host uses a user-only Unix
socket and a new random per-host secret stored in
`~/.config/webmcp-today/bridge.json`. That stable path is a user-only symlink to a
private per-host `0600` configuration record. It is atomically replaced after the
host socket is listening, then intentionally left stale on shutdown while the owning
host removes its socket and private record. A stale path is not availability evidence:
only a successful socket connection establishes that Chrome's bridge is available.
The dangling symlink retains no usable secret after normal shutdown, and a successor
replaces it without reclaiming old session artifacts.

Each MCP-to-Chrome request has a 10-second socket timeout (capped at one minute
for injected test transports). Before an execute write, the host sends a
correlated prepare marker and waits up to two seconds for the MCP client to
process it and return a correlated acknowledgement. Without that acknowledgement,
the host does not write to Chrome and returns `dispatch-failed`. Once the client
receives the marker, a timeout, disconnect, or incompatible response after a
successful Chrome write returns `execution-timeout`: Chrome may still complete the
tool call, so verify its effect before retrying. A synchronous Chrome write failure
after acknowledgement returns `dispatch-failed`, confirming that the tool did not
run and can be retried. List requests retain ordinary `bridge-unavailable`
transport semantics. An incompatible response before dispatch returns
`protocol-mismatch` instead.
