import { LOCAL_BRIDGE_NATIVE_HOST_NAME } from "@robertn702/webmcp-today-schema";
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import { homedir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const nativeHostDescription = "WebMCP Today local bridge";
export const developmentExtensionId = "peaiababjjehplphfkhefdlgefaaemkl";
export const releaseExtensionId = "kngdblibgfakdkfgbbolnmgajaacchgb";

export type Browser = "brave" | "chrome";

export interface NativeHostInstallerDeps {
  platform: string;
  homedir: () => string;
  execPath: string;
  isBun: boolean;
  packageRoot: string;
  fs: typeof fs;
  path: typeof path;
}

export interface NativeHostPaths {
  configurationDirectory: string;
  bridgeConfigurationPath: string;
  hostPath: string;
  wrapperPath: string;
  manifestPath: string;
  manifestPaths: string[];
  manifestDirectory: string;
  manifestDirectories: string[];
}

export interface NativeHostInstallationOptions {
  extensionId: string;
  homeDirectory: string;
  nodePath: string;
  nativeHostPath: string;
  browser?: Browser;
  publicInstallation?: boolean;
}

export interface InstallBridgeOptions {
  browser: Browser;
  extensionId?: string;
  homeDirectory?: string;
}

export interface InstallBridgeResult extends NativeHostPaths {
  installed: true;
  browser: Browser;
  extensionId: string;
}

export interface BridgeManifestStatus {
  path: string;
  present: boolean;
  matchedId: "release" | "development" | "other" | null;
  valid: boolean;
  mode?: number;
}

export interface BridgeStatus {
  platform: string;
  browser: Browser;
  manifest: BridgeManifestStatus | null;
  manifests: BridgeManifestStatus[];
  host: { path: string; present: boolean; mode?: number };
  wrapper: { path: string; present: boolean; executable: boolean; mode?: number };
  configDirectory: { path: string; present: boolean; mode?: number };
  bridgeConfig: { path: string; present: boolean };
  ready: boolean;
}

export interface UninstallBridgeResult {
  browser: Browser;
  removed: string[];
  notFound: string[];
  residual: string[];
  followUp: string | null;
}

const browserManifestDirectories: Record<Browser, string[][]> = {
  brave: [
    ["BraveSoftware", "Brave-Browser"],
    ["Google", "Chrome"],
  ],
  chrome: [["Google", "Chrome"]],
};

export function createNativeHostInstallerDeps(): NativeHostInstallerDeps {
  return {
    platform: process.platform,
    homedir,
    execPath: process.execPath,
    isBun: Boolean(process.versions.bun),
    packageRoot: path.dirname(path.dirname(fileURLToPath(import.meta.url))),
    fs,
    path,
  };
}

export function nativeHostPaths(
  homeDirectory: string,
  browser: Browser = "chrome",
  pathApi: typeof path = path,
  installation: "development" | "public" = "development",
): NativeHostPaths {
  const browserDirectories = browserManifestDirectories[browser];
  if (!browserDirectories) throw new Error('Browser must be either "brave" or "chrome".');

  const configurationDirectory = pathApi.join(homeDirectory, ".config", "webmcp-today");
  const manifestDirectories = browserDirectories.map((directory) =>
    pathApi.join(
      homeDirectory,
      "Library",
      "Application Support",
      ...directory,
      "NativeMessagingHosts",
    ),
  );
  const manifestPaths = manifestDirectories.map((directory) =>
    pathApi.join(directory, `${LOCAL_BRIDGE_NATIVE_HOST_NAME}.json`),
  );
  const manifestPath = manifestPaths[0];
  const manifestDirectory = manifestDirectories[0];
  if (!manifestPath || !manifestDirectory)
    throw new Error("Native host manifest path was not resolved.");

  return {
    configurationDirectory,
    bridgeConfigurationPath: pathApi.join(configurationDirectory, "bridge.json"),
    hostPath: pathApi.join(
      configurationDirectory,
      installation === "public" ? "native-host-public" : "native-host",
    ),
    wrapperPath: pathApi.join(
      configurationDirectory,
      installation === "public" ? "native-host-public-wrapper" : "native-host",
    ),
    manifestPath,
    manifestPaths,
    manifestDirectory,
    manifestDirectories,
  };
}

export function nativeHostManifest({
  extensionId,
  wrapperPath,
}: {
  extensionId: string;
  wrapperPath: string;
}) {
  return {
    name: LOCAL_BRIDGE_NATIVE_HOST_NAME,
    description: nativeHostDescription,
    path: wrapperPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };
}

export function nativeHostWrapper({
  nodePath,
  nativeHostPath,
}: {
  nodePath: string;
  nativeHostPath: string;
}): string {
  return `#!/bin/sh\nexec ${shellQuote(nodePath)} ${shellQuote(nativeHostPath)}\n`;
}

export async function writeNativeHostInstallation(
  deps: Pick<NativeHostInstallerDeps, "fs" | "path">,
  {
    extensionId,
    homeDirectory,
    nodePath,
    nativeHostPath,
    browser = "chrome",
    publicInstallation = false,
  }: NativeHostInstallationOptions,
): Promise<NativeHostPaths> {
  assertExtensionId(extensionId);
  if (!deps.path.isAbsolute(nodePath)) {
    throw new Error("Native host interpreter path must be absolute.");
  }

  try {
    await deps.fs.access(nodePath, constants.X_OK);
  } catch {
    throw new Error(`Native host interpreter is not executable: ${nodePath}`);
  }
  try {
    await deps.fs.access(nativeHostPath, constants.R_OK);
  } catch {
    throw new Error(
      'Built native host is missing. Run `bunx turbo run build --filter="@robertn702/webmcp-today-mcp..."` first.',
    );
  }

  const paths = nativeHostPaths(
    homeDirectory,
    browser,
    deps.path,
    publicInstallation ? "public" : "development",
  );
  await deps.fs.mkdir(paths.configurationDirectory, { recursive: true, mode: 0o700 });
  await deps.fs.chmod(paths.configurationDirectory, 0o700);
  await deps.fs.writeFile(paths.wrapperPath, nativeHostWrapper({ nodePath, nativeHostPath }), {
    mode: 0o755,
  });
  await deps.fs.chmod(paths.wrapperPath, 0o755);

  const manifest = `${JSON.stringify(
    nativeHostManifest({ extensionId, wrapperPath: paths.wrapperPath }),
    null,
    2,
  )}\n`;
  for (const [index, manifestDirectory] of paths.manifestDirectories.entries()) {
    const manifestPath = paths.manifestPaths[index];
    if (!manifestPath) throw new Error("Native host manifest path was not resolved.");
    await deps.fs.mkdir(manifestDirectory, { recursive: true });
    await deps.fs.writeFile(manifestPath, manifest, { mode: 0o644 });
    await deps.fs.chmod(manifestPath, 0o644);
  }

  return paths;
}

export async function installBridge(
  deps: NativeHostInstallerDeps,
  {
    browser,
    extensionId = releaseExtensionId,
    homeDirectory = deps.homedir(),
  }: InstallBridgeOptions,
): Promise<InstallBridgeResult> {
  assertMacos(deps);
  assertPersistentPackageRoot(deps.packageRoot);
  assertPublicExtensionId(extensionId);

  const sourceHostPath = deps.path.join(deps.packageRoot, "dist", "native-host.standalone.js");
  const paths = nativeHostPaths(homeDirectory, browser, deps.path, "public");
  try {
    await deps.fs.access(sourceHostPath, constants.R_OK);
  } catch {
    throw new Error(
      "Built standalone native host is missing. Rebuild the MCP package, then retry setup.",
    );
  }

  await deps.fs.mkdir(paths.configurationDirectory, { recursive: true, mode: 0o700 });
  await deps.fs.chmod(paths.configurationDirectory, 0o700);
  await deps.fs.copyFile(sourceHostPath, paths.hostPath);
  await deps.fs.chmod(paths.hostPath, 0o700);
  const installation = await writeNativeHostInstallation(deps, {
    browser,
    extensionId,
    homeDirectory,
    nodePath: deps.execPath,
    nativeHostPath: paths.hostPath,
    publicInstallation: true,
  });

  return { ...installation, installed: true, browser, extensionId };
}

export async function getBridgeStatus(
  deps: NativeHostInstallerDeps,
  { browser }: { browser: Browser },
): Promise<BridgeStatus> {
  assertMacos(deps);
  const paths = nativeHostPaths(deps.homedir(), browser, deps.path, "public");
  const manifests = await Promise.all(
    paths.manifestPaths.map((manifestPath) =>
      manifestStatus(deps, manifestPath, paths.wrapperPath),
    ),
  );
  const host = await fileStatus(deps, paths.hostPath);
  const wrapper = await wrapperStatus(deps, paths.wrapperPath);
  const configDirectory = await directoryStatus(deps, paths.configurationDirectory);
  const bridgeConfig = {
    path: paths.bridgeConfigurationPath,
    present: await isSymlink(deps, paths.bridgeConfigurationPath),
  };
  const primaryManifest = manifests[0] ?? null;
  const ready =
    manifests.every((manifest) => manifest.valid && manifest.mode === 0o644) &&
    host.present &&
    host.mode === 0o700 &&
    wrapper.present &&
    wrapper.executable &&
    wrapper.mode === 0o755 &&
    configDirectory.present &&
    configDirectory.mode === 0o700;

  return {
    platform: deps.platform,
    browser,
    manifest: primaryManifest,
    manifests,
    host,
    wrapper,
    configDirectory,
    bridgeConfig,
    ready,
  };
}

export async function uninstallBridge(
  deps: NativeHostInstallerDeps,
  {
    browser,
    homeDirectory = deps.homedir(),
  }: Pick<InstallBridgeOptions, "browser" | "homeDirectory">,
): Promise<UninstallBridgeResult> {
  assertMacos(deps);
  const paths = nativeHostPaths(homeDirectory, browser, deps.path, "public");
  const removed: string[] = [];
  const notFound: string[] = [];
  const residual: string[] = [];
  const publicManifestPaths = await supportedPublicManifestPaths(
    deps,
    homeDirectory,
    paths.wrapperPath,
  );
  const braveManifestPath = nativeHostPaths(
    homeDirectory,
    "brave",
    deps.path,
    "public",
  ).manifestPath;
  const targets =
    browser === "brave"
      ? publicManifestPaths.filter((manifestPath) => manifestPath === braveManifestPath)
      : publicManifestPaths.includes(braveManifestPath)
        ? []
        : publicManifestPaths.filter((manifestPath) => paths.manifestPaths.includes(manifestPath));
  if (browser === "brave" && publicManifestPaths.includes(braveManifestPath)) {
    const chromeCompatibilityManifest = paths.manifestPaths[1];
    if (!chromeCompatibilityManifest)
      throw new Error("Chrome compatibility manifest path was not resolved.");
    residual.push(chromeCompatibilityManifest);
  }

  for (const target of targets) {
    await unlinkTracked(deps, target, removed, notFound);
  }
  if (!publicManifestPaths.some((manifestPath) => !targets.includes(manifestPath))) {
    await unlinkTracked(deps, paths.wrapperPath, removed, notFound);
    await unlinkTracked(deps, paths.hostPath, removed, notFound);
    if (await isSymlink(deps, paths.bridgeConfigurationPath)) {
      await unlinkTracked(deps, paths.bridgeConfigurationPath, removed, notFound);
    }
    try {
      const entries = await deps.fs.readdir(paths.configurationDirectory);
      await Promise.all(
        entries
          .filter((entry) => /^bridge-[a-f0-9]+\.sock$/.test(entry))
          .map(async (entry) =>
            unlinkTracked(
              deps,
              deps.path.join(paths.configurationDirectory, entry),
              removed,
              notFound,
            ),
          ),
      );
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  return {
    browser,
    removed,
    notFound,
    residual,
    followUp:
      residual.length > 0
        ? "Brave can use the retained Chrome compatibility manifest. Call uninstall_webmcp_bridge again with browser: chrome and confirm: true to complete bridge removal after closing Chrome and Brave."
        : null,
  };
}

export function isPersistentPackageRoot(packageRoot: string): boolean {
  const normalized = packageRoot.replaceAll("\\", "/");
  return !["/.npm/_npx/", "/.bun/install/cache/", "/pnpm/.pnpm/", "/tmp/"].some((indicator) =>
    normalized.includes(indicator),
  );
}

function assertMacos(deps: Pick<NativeHostInstallerDeps, "platform" | "isBun">): void {
  if (deps.platform !== "darwin")
    throw new Error("The WebMCP Today bridge setup supports macOS only.");
  if (deps.isBun) throw new Error("The WebMCP Today bridge setup must run under Node, not Bun.");
}

function assertPersistentPackageRoot(packageRoot: string): void {
  if (!isPersistentPackageRoot(packageRoot)) {
    throw new Error(
      "The WebMCP Today bridge cannot be installed from an ephemeral package-manager cache. Install the MCP package persistently, then retry.",
    );
  }
}

function assertExtensionId(extensionId: string): void {
  if (!/^[a-p]{32}$/.test(extensionId)) {
    throw new Error("A 32-character Chrome extension ID is required.");
  }
}

function assertPublicExtensionId(extensionId: string): void {
  if (extensionId !== releaseExtensionId && extensionId !== developmentExtensionId) {
    throw new Error(
      "Public bridge setup supports only the official release or development extension ID.",
    );
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

async function manifestStatus(
  deps: NativeHostInstallerDeps,
  manifestPath: string,
  wrapperPath: string,
): Promise<BridgeManifestStatus> {
  const file = await statIfPresent(deps, manifestPath);
  if (!file) return { path: manifestPath, present: false, matchedId: null, valid: false };

  let matchedId: BridgeManifestStatus["matchedId"] = "other";
  let valid = false;
  try {
    const manifest = JSON.parse(await deps.fs.readFile(manifestPath, "utf8"));
    const origins =
      typeof manifest === "object" && manifest !== null
        ? Reflect.get(manifest, "allowed_origins")
        : undefined;
    if (Array.isArray(origins) && origins.length === 1 && typeof origins[0] === "string") {
      if (origins[0] === `chrome-extension://${releaseExtensionId}/`) matchedId = "release";
      if (origins[0] === `chrome-extension://${developmentExtensionId}/`) matchedId = "development";
    }
    valid =
      matchedId !== "other" &&
      Reflect.get(manifest, "name") === LOCAL_BRIDGE_NATIVE_HOST_NAME &&
      Reflect.get(manifest, "type") === "stdio" &&
      Reflect.get(manifest, "path") === wrapperPath;
  } catch {
    // A malformed manifest is present but cannot be attributed to a known extension identity.
  }

  return { path: manifestPath, present: true, matchedId, valid, mode: file.mode & 0o777 };
}

async function wrapperStatus(deps: NativeHostInstallerDeps, wrapperPath: string) {
  const file = await statIfPresent(deps, wrapperPath);
  if (!file) return { path: wrapperPath, present: false, executable: false };
  const mode = file.mode & 0o777;
  return { path: wrapperPath, present: true, executable: (mode & 0o111) !== 0, mode };
}

async function directoryStatus(deps: NativeHostInstallerDeps, directoryPath: string) {
  const file = await statIfPresent(deps, directoryPath);
  if (!file) return { path: directoryPath, present: false };
  return { path: directoryPath, present: true, mode: file.mode & 0o777 };
}

async function fileStatus(deps: NativeHostInstallerDeps, filePath: string) {
  const file = await statIfPresent(deps, filePath);
  if (!file) return { path: filePath, present: false };
  return { path: filePath, present: true, mode: file.mode & 0o777 };
}

async function statIfPresent(deps: NativeHostInstallerDeps, target: string) {
  try {
    return await deps.fs.stat(target);
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
}

async function isSymlink(deps: NativeHostInstallerDeps, target: string): Promise<boolean> {
  try {
    return (await deps.fs.lstat(target)).isSymbolicLink();
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

async function unlinkTracked(
  deps: NativeHostInstallerDeps,
  target: string,
  removed: string[],
  notFound: string[],
): Promise<void> {
  try {
    await deps.fs.unlink(target);
    removed.push(target);
  } catch (error) {
    if (isNotFound(error)) {
      notFound.push(target);
      return;
    }
    throw error;
  }
}

async function supportedPublicManifestPaths(
  deps: NativeHostInstallerDeps,
  homeDirectory: string,
  wrapperPath: string,
): Promise<string[]> {
  const manifestDirectories = [
    ...browserManifestDirectories.chrome,
    ...browserManifestDirectories.brave,
  ].filter(
    (directory, index, all) =>
      index === all.findIndex((candidate) => candidate.join("/") === directory.join("/")),
  );
  const supported: string[] = [];
  for (const directory of manifestDirectories) {
    const manifestPath = deps.path.join(
      homeDirectory,
      "Library",
      "Application Support",
      ...directory,
      "NativeMessagingHosts",
      `${LOCAL_BRIDGE_NATIVE_HOST_NAME}.json`,
    );
    try {
      const manifest = JSON.parse(await deps.fs.readFile(manifestPath, "utf8"));
      if (isSupportedPublicManifest(manifest, wrapperPath)) {
        supported.push(manifestPath);
      }
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  return supported;
}

function isSupportedPublicManifest(manifest: unknown, wrapperPath: string): boolean {
  if (typeof manifest !== "object" || manifest === null) return false;
  const origins = Reflect.get(manifest, "allowed_origins");
  return (
    Reflect.get(manifest, "name") === LOCAL_BRIDGE_NATIVE_HOST_NAME &&
    Reflect.get(manifest, "type") === "stdio" &&
    Reflect.get(manifest, "path") === wrapperPath &&
    Array.isArray(origins) &&
    origins.length === 1 &&
    (origins[0] === `chrome-extension://${releaseExtensionId}/` ||
      origins[0] === `chrome-extension://${developmentExtensionId}/`)
  );
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && Reflect.get(error, "code") === "ENOENT";
}
