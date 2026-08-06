# WebMCP Today MCP bridge

`webmcp-today-mcp` exposes registry operations, three browser bridge tools, and
first-party macOS bridge setup tools:

- `list_connected_webmcp_tabs`
- `list_webmcp_tools`
- `execute_webmcp_tool`
- `setup_webmcp_bridge`
- `get_webmcp_bridge_status`
- `uninstall_webmcp_bridge`

The bridge calls WebMCP's consumer API in the existing extension content script.
It does not enable WebMCP, run JavaScript, proxy CDP, read cookies, or expose an
HTTP port. Package API execution stays inside the page content script; a
destructive package tool still blocks on the browser's `window.confirm`.

## macOS setup

The first-party native bridge supports macOS Chrome and Brave. Once this package is
published, install it globally with Node 20 or newer. Bridge setup intentionally rejects
ephemeral package-manager caches:

```bash
npm install --global @webmcp-today/mcp-bridge@0.1.1
webmcp-today-mcp
```

Configure your MCP client to run `webmcp-today-mcp`, then restart it. Ask it to call
`setup_webmcp_bridge` with `confirm: true` and `browser: "chrome"` (or `"brave"`).
The tool copies the bundled host to `~/.config/webmcp-today/native-host-public` and writes
only WebMCP Today's native-messaging manifest(s). Setup uses the official release extension
ID by default; its only override is the documented development ID.

Use `get_webmcp_bridge_status` to inspect the installation. It reports paths and
permissions but never exposes the bridge secret. Use `uninstall_webmcp_bridge` with
`confirm: true` to remove only browser-owned manifest paths and unused bridge artifacts.
For Brave, the result intentionally retains the Chrome compatibility manifest because Brave 151
may launch it from that root. It returns that manifest in `residual` and requires a second
confirmed `uninstall_webmcp_bridge` call with `browser: "chrome"` to complete removal after
closing Chrome and Brave. Do not claim the bridge is fully removed until that follow-up reports
no residual paths.

Chrome and Brave still need WebMCP enabled (`chrome://flags/#enable-webmcp-testing`
or `brave://flags/#enable-webmcp-testing` in the current preview). The bridge does not
enable WebMCP, run JavaScript, proxy CDP, or expose an HTTP port.

## macOS development setup

1. Build the MCP package and its schema dependency:

   ```bash
   bunx turbo run build --filter="@webmcp-today/mcp-bridge..."
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

4. Start the MCP server with `node packages/mcp/dist/index.js`, select a normal
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
setup after upgrading Node, then use `get_webmcp_bridge_status` to verify the new wrapper before
using the bridge again.
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
