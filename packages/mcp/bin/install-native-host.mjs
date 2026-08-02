#!/usr/bin/env node
import { homedir, platform } from "node:os";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  developmentExtensionId,
  nativeHostManifest,
  nativeHostPaths,
  nativeHostWrapper,
  writeNativeHostInstallation as writeInstallation,
} from "../dist/native-host-installer.js";

export { developmentExtensionId, nativeHostManifest, nativeHostPaths, nativeHostWrapper };

export async function writeNativeHostInstallation(options) {
  return writeInstallation(
    {
      fs: await import("node:fs/promises"),
      path: await import("node:path"),
    },
    options,
  );
}

export async function installDevelopmentNativeHost({ extensionId, browser }) {
  return writeNativeHostInstallation({
    extensionId,
    homeDirectory: homedir(),
    nodePath: process.execPath,
    nativeHostPath: fileURLToPath(import.meta.resolve("../dist/native-host.js")),
    browser,
  });
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
  if (browser !== "brave" && browser !== "chrome") {
    throw new Error('Browser must be either "brave" or "chrome".');
  }
  const paths = await installDevelopmentNativeHost({
    extensionId: extensionIdArgument ?? developmentExtensionId,
    browser,
  });
  process.stdout.write(
    `Installed WebMCP Today native-host manifest at ${paths.manifestPaths.join(" and ")}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
