#!/usr/bin/env node
import { access, chmod, constants, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join } from "node:path";
import { homedir, platform } from "node:os";
import process from "node:process";
import { LOCAL_BRIDGE_NATIVE_HOST_NAME } from "@robertn702/webmcp-today-schema";

const nativeHostDescription = "WebMCP Today local bridge";
export const developmentExtensionId = "peaiababjjehplphfkhefdlgefaaemkl";

const browserManifestDirectories = {
  brave: [
    ["BraveSoftware", "Brave-Browser"],
    ["Google", "Chrome"],
  ],
  chrome: [["Google", "Chrome"]],
};

export function nativeHostPaths(homeDirectory, browser = "chrome") {
  const browserDirectory = browserManifestDirectories[browser];
  if (!browserDirectory) {
    throw new Error('Browser must be either "brave" or "chrome".');
  }

  const configurationDirectory = join(homeDirectory, ".config", "webmcp-today");
  const manifestDirectories = browserDirectory.map((directory) =>
    join(homeDirectory, "Library", "Application Support", ...directory, "NativeMessagingHosts"),
  );
  const manifestPaths = manifestDirectories.map((directory) =>
    join(directory, `${LOCAL_BRIDGE_NATIVE_HOST_NAME}.json`),
  );

  return {
    configurationDirectory,
    wrapperPath: join(configurationDirectory, "native-host"),
    manifestPath: manifestPaths[0],
    manifestPaths,
    manifestDirectory: manifestDirectories[0],
    manifestDirectories,
  };
}

export function nativeHostManifest({ extensionId, wrapperPath }) {
  return {
    name: LOCAL_BRIDGE_NATIVE_HOST_NAME,
    description: nativeHostDescription,
    path: wrapperPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

export function nativeHostWrapper({ nodePath, nativeHostPath }) {
  return `#!/bin/sh\nexec ${shellQuote(nodePath)} ${shellQuote(nativeHostPath)}\n`;
}

export async function writeNativeHostInstallation({
  extensionId,
  homeDirectory,
  nodePath,
  nativeHostPath,
  browser = "chrome",
}) {
  if (!/^[a-p]{32}$/.test(extensionId)) {
    throw new Error("Usage: install-native-host.mjs <32-character Chrome extension ID>");
  }
  if (!isAbsolute(nodePath)) {
    throw new Error("Native host interpreter path must be absolute.");
  }

  try {
    await access(nodePath, constants.X_OK);
  } catch {
    throw new Error(`Native host interpreter is not executable: ${nodePath}`);
  }
  try {
    await access(nativeHostPath, constants.R_OK);
  } catch {
    throw new Error(
      'Built native host is missing. Run `bunx turbo run build --filter="@robertn702/webmcp-today-mcp..."` first.',
    );
  }

  const paths = nativeHostPaths(homeDirectory, browser);
  await mkdir(paths.configurationDirectory, { recursive: true, mode: 0o700 });
  await chmod(paths.configurationDirectory, 0o700);
  await writeFile(paths.wrapperPath, nativeHostWrapper({ nodePath, nativeHostPath }), {
    mode: 0o755,
  });
  await chmod(paths.wrapperPath, 0o755);

  const manifest = `${JSON.stringify(
    nativeHostManifest({ extensionId, wrapperPath: paths.wrapperPath }),
    null,
    2,
  )}\n`;
  for (const [index, manifestDirectory] of paths.manifestDirectories.entries()) {
    const manifestPath = paths.manifestPaths[index];
    if (!manifestPath) throw new Error("Native host manifest path was not resolved.");
    await mkdir(manifestDirectory, { recursive: true });
    await writeFile(manifestPath, manifest, { mode: 0o644 });
    await chmod(manifestPath, 0o644);
  }

  return paths;
}

async function main() {
  if (platform() !== "darwin") {
    throw new Error("This development installer currently supports macOS only.");
  }
  if (process.versions.bun) {
    throw new Error("Run this macOS development installer with Node, not Bun.");
  }

  const arguments_ = process.argv.slice(2);
  const browserArgument = arguments_.find((argument) => argument.startsWith("--browser="));
  const extensionIdArgument = arguments_.find((argument) => !argument.startsWith("--"));
  if (
    arguments_.length > (browserArgument ? 1 : 0) + (extensionIdArgument ? 1 : 0) ||
    arguments_.some((argument) => argument.startsWith("--") && !argument.startsWith("--browser="))
  ) {
    throw new Error("Usage: install-native-host.mjs [extension-id] [--browser=brave|chrome]");
  }
  const browser = browserArgument?.replace("--browser=", "") ?? "chrome";

  const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
  const paths = await writeNativeHostInstallation({
    extensionId: extensionIdArgument ?? developmentExtensionId,
    homeDirectory: homedir(),
    nodePath: process.execPath,
    nativeHostPath: join(packageDirectory, "dist", "native-host.js"),
    browser,
  });

  process.stdout.write(
    `Installed WebMCP Today native-host manifest at ${paths.manifestPaths.join(" and ")}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
