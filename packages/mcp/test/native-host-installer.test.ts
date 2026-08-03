import { lstat, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNativeHostInstallerDeps,
  developmentExtensionId,
  getBridgeStatus,
  installBridge,
  releaseExtensionId,
  uninstallBridge,
  writeNativeHostInstallation,
  type NativeHostInstallerDeps,
} from "../src/native-host-installer.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("public macOS native-host installer", () => {
  it("uses the documented release identity", () => {
    expect(releaseExtensionId).toBe("kngdblibgfakdkfgbbolnmgajaacchgb");
  });

  it("installs the release host durably for Chrome and Brave", async () => {
    const chrome = await testDeps();
    const chromeResult = await installBridge(chrome.deps, { browser: "chrome" });
    const chromeManifest = JSON.parse(await readFile(chromeResult.manifestPath, "utf8"));

    expect(chromeManifest.allowed_origins).toEqual([`chrome-extension://${releaseExtensionId}/`]);
    expect(chromeResult.hostPath).toBe(
      path.join(chrome.homeDirectory, ".config", "webmcp-today", "native-host-public"),
    );
    expect((await stat(chromeResult.hostPath)).mode & 0o777).toBe(0o700);
    expect((await stat(chromeResult.wrapperPath)).mode & 0o777).toBe(0o755);
    expect((await stat(chromeResult.configurationDirectory)).mode & 0o777).toBe(0o700);
    expect(await readFile(chromeResult.wrapperPath, "utf8")).toContain(chromeResult.hostPath);

    const brave = await testDeps();
    const braveResult = await installBridge(brave.deps, { browser: "brave" });
    const braveManifests = await Promise.all(
      braveResult.manifestPaths.map((manifestPath) => readFile(manifestPath, "utf8")),
    );
    expect(braveManifests).toHaveLength(2);
    expect(braveManifests[1]).toBe(braveManifests[0]);
  });

  it("accepts an explicit development extension identity", async () => {
    const { deps } = await testDeps();
    const result = await installBridge(deps, {
      browser: "chrome",
      extensionId: developmentExtensionId,
    });

    expect(JSON.parse(await readFile(result.manifestPath, "utf8")).allowed_origins).toEqual([
      `chrome-extension://${developmentExtensionId}/`,
    ]);
  });

  it("rejects public setup extension IDs other than the supported development override", async () => {
    const { deps } = await testDeps();

    await expect(
      installBridge(deps, { browser: "chrome", extensionId: "abcdefghijklmnopabcdefghijklmnop" }),
    ).rejects.toThrow("official release or development");
  });

  it("rejects non-macOS, Bun, and ephemeral package-cache setup before writing", async () => {
    const linux = await testDeps({ platform: "linux" });
    await expect(installBridge(linux.deps, { browser: "chrome" })).rejects.toThrow("macOS only");
    await expect(getBridgeStatus(linux.deps, { browser: "chrome" })).rejects.toThrow("macOS only");
    await expect(uninstallBridge(linux.deps, { browser: "chrome" })).rejects.toThrow("macOS only");

    const bun = await testDeps({ isBun: true });
    await expect(installBridge(bun.deps, { browser: "chrome" })).rejects.toThrow("Node, not Bun");

    const cached = await testDeps({
      packageRoot: "/tmp/.npm/_npx/abc/node_modules/@robertn702/webmcp-today-mcp",
    });
    await expect(installBridge(cached.deps, { browser: "chrome" })).rejects.toThrow("ephemeral");
    await expect(
      stat(path.join(cached.homeDirectory, ".config", "webmcp-today")),
    ).rejects.toThrow();
  });

  it("reports known manifest identity and sane installation status", async () => {
    const { deps, homeDirectory } = await testDeps();
    const before = await getBridgeStatus(deps, { browser: "chrome" });
    expect(before.manifest).toMatchObject({ present: false, matchedId: null, valid: false });
    expect(before.wrapper).toMatchObject({ present: false, executable: false });
    expect(before.ready).toBe(false);

    const installation = await installBridge(deps, { browser: "chrome" });
    const after = await getBridgeStatus(deps, { browser: "chrome" });
    expect(after.manifest).toMatchObject({
      present: true,
      matchedId: "release",
      valid: true,
      mode: 0o644,
    });
    expect(after.host).toMatchObject({ present: true, mode: 0o700 });
    expect(after.wrapper).toMatchObject({ present: true, executable: true, mode: 0o755 });
    expect(after.configDirectory).toMatchObject({ present: true, mode: 0o700 });
    expect(after.ready).toBe(true);

    await writeFile(
      installation.manifestPath,
      JSON.stringify({ allowed_origins: [`chrome-extension://${developmentExtensionId}/`] }),
    );
    expect((await getBridgeStatus(deps, { browser: "chrome" })).manifest).toMatchObject({
      matchedId: "development",
      valid: false,
    });
    expect(homeDirectory).toBeDefined();
  });

  it("cleans unused public artifacts while preserving other config files", async () => {
    const { deps, homeDirectory } = await testDeps();
    const installation = await installBridge(deps, { browser: "chrome" });
    await writeFile(path.join(installation.configurationDirectory, "keep-me"), "keep");
    await symlink("bridge-session", installation.bridgeConfigurationPath);
    await writeFile(path.join(installation.configurationDirectory, "bridge-1234abcd.sock"), "");

    const result = await uninstallBridge(deps, { browser: "chrome" });
    expect(result.removed).toEqual(
      expect.arrayContaining([
        installation.manifestPath,
        installation.wrapperPath,
        installation.hostPath,
        installation.bridgeConfigurationPath,
      ]),
    );
    expect(
      await readFile(path.join(homeDirectory, ".config", "webmcp-today", "keep-me"), "utf8"),
    ).toBe("keep");
    expect((await uninstallBridge(deps, { browser: "chrome" })).notFound).toContain(
      installation.wrapperPath,
    );
  });

  it("keeps shared host artifacts while another browser manifest references them", async () => {
    const { deps } = await testDeps();
    const chrome = await installBridge(deps, { browser: "chrome" });
    await installBridge(deps, { browser: "brave" });
    await symlink("bridge-session", chrome.bridgeConfigurationPath);
    await writeFile(path.join(chrome.configurationDirectory, "bridge-1234abcd.sock"), "");

    const result = await uninstallBridge(deps, { browser: "chrome" });
    expect(result.removed).not.toContain(chrome.manifestPath);
    expect(result.removed).not.toContain(chrome.wrapperPath);
    expect(result.removed).not.toContain(chrome.hostPath);
    expect(result.removed).not.toContain(chrome.bridgeConfigurationPath);
    await expect(stat(chrome.wrapperPath)).resolves.toBeDefined();
    await expect(stat(chrome.hostPath)).resolves.toBeDefined();
    await expect(lstat(chrome.bridgeConfigurationPath)).resolves.toBeDefined();
    await expect(
      stat(path.join(chrome.configurationDirectory, "bridge-1234abcd.sock")),
    ).resolves.toBeDefined();
  });

  it("does not remove Chrome's compatibility manifest when uninstalling Brave", async () => {
    const { deps } = await testDeps();
    const brave = await installBridge(deps, { browser: "brave" });
    const chromeCompatibilityManifest = brave.manifestPaths[1];
    if (!chromeCompatibilityManifest)
      throw new Error("Expected Brave Chrome compatibility manifest.");

    const result = await uninstallBridge(deps, { browser: "brave" });
    expect(result.removed).toContain(brave.manifestPath);
    expect(result.removed).not.toContain(chromeCompatibilityManifest);
    expect(result.removed).not.toContain(brave.wrapperPath);
    expect(result.removed).not.toContain(brave.hostPath);
    expect(result.residual).toEqual([chromeCompatibilityManifest]);
    expect(result.followUp).toContain("browser: chrome");
    await expect(stat(chromeCompatibilityManifest)).resolves.toBeDefined();
    await expect(stat(brave.wrapperPath)).resolves.toBeDefined();
    await expect(stat(brave.hostPath)).resolves.toBeDefined();
  });

  it("fully removes a Brave-only installation after the required Chrome follow-up", async () => {
    const { deps } = await testDeps();
    const brave = await installBridge(deps, { browser: "brave" });
    const chromeCompatibilityManifest = brave.manifestPaths[1];
    if (!chromeCompatibilityManifest)
      throw new Error("Expected Brave Chrome compatibility manifest.");

    const braveRemoval = await uninstallBridge(deps, { browser: "brave" });
    expect(braveRemoval.residual).toEqual([chromeCompatibilityManifest]);
    expect(braveRemoval.followUp).toContain("browser: chrome");
    const chromeRemoval = await uninstallBridge(deps, { browser: "chrome" });

    expect(chromeRemoval.residual).toEqual([]);
    expect(chromeRemoval.followUp).toBeNull();
    expect(chromeRemoval.removed).toEqual(
      expect.arrayContaining([chromeCompatibilityManifest, brave.wrapperPath, brave.hostPath]),
    );
    await expect(lstat(brave.manifestPath)).rejects.toThrow();
    await expect(lstat(chromeCompatibilityManifest)).rejects.toThrow();
    await expect(lstat(brave.wrapperPath)).rejects.toThrow();
    await expect(lstat(brave.hostPath)).rejects.toThrow();
  });

  it("retains public and development installations in either install order", async () => {
    const publicThenDevelopment = await testDeps();
    const publicFirst = await installBridge(publicThenDevelopment.deps, { browser: "chrome" });
    const devHost = path.join(publicThenDevelopment.homeDirectory, "dev-native-host.js");
    await writeFile(devHost, "export {};\n");
    const developmentSecond = await writeNativeHostInstallation(publicThenDevelopment.deps, {
      extensionId: developmentExtensionId,
      homeDirectory: publicThenDevelopment.homeDirectory,
      nodePath: process.execPath,
      nativeHostPath: devHost,
    });
    expect(publicFirst.hostPath).not.toBe(developmentSecond.hostPath);
    expect(publicFirst.wrapperPath).not.toBe(developmentSecond.wrapperPath);
    await expect(stat(publicFirst.hostPath)).resolves.toBeDefined();
    await expect(stat(developmentSecond.wrapperPath)).resolves.toBeDefined();

    const developmentThenPublic = await testDeps();
    const developmentHost = path.join(developmentThenPublic.homeDirectory, "dev-native-host.js");
    await writeFile(developmentHost, "export {};\n");
    const developmentFirst = await writeNativeHostInstallation(developmentThenPublic.deps, {
      extensionId: developmentExtensionId,
      homeDirectory: developmentThenPublic.homeDirectory,
      nodePath: process.execPath,
      nativeHostPath: developmentHost,
    });
    const publicSecond = await installBridge(developmentThenPublic.deps, { browser: "chrome" });
    expect(developmentFirst.hostPath).not.toBe(publicSecond.hostPath);
    expect(developmentFirst.wrapperPath).not.toBe(publicSecond.wrapperPath);
    await expect(stat(developmentFirst.wrapperPath)).resolves.toBeDefined();
    await expect(stat(publicSecond.wrapperPath)).resolves.toBeDefined();
  });

  it("treats development manifests as not ready for public status", async () => {
    const { deps, homeDirectory } = await testDeps();
    const devHost = path.join(homeDirectory, "dev-native-host.js");
    await writeFile(devHost, "export {};\n");
    await writeNativeHostInstallation(deps, {
      extensionId: developmentExtensionId,
      homeDirectory,
      nodePath: process.execPath,
      nativeHostPath: devHost,
    });

    const status = await getBridgeStatus(deps, { browser: "chrome" });
    expect(status.manifest).toMatchObject({ matchedId: "development", valid: false });
    expect(status.ready).toBe(false);
  });

  it("fails closed when a supported manifest cannot be read during uninstall", async () => {
    const { deps } = await testDeps();
    const installation = await installBridge(deps, { browser: "chrome" });
    const unreadableDeps = {
      ...deps,
      fs: {
        ...deps.fs,
        readFile: vi.fn(async () => {
          throw Object.assign(new Error("permission denied"), { code: "EACCES" });
        }),
      },
    };

    await expect(uninstallBridge(unreadableDeps, { browser: "chrome" })).rejects.toThrow(
      "permission denied",
    );
    await expect(lstat(installation.manifestPath)).resolves.toBeDefined();
  });
});

async function testDeps(
  overrides: Partial<Pick<NativeHostInstallerDeps, "platform" | "isBun" | "packageRoot">> = {},
) {
  const homeDirectory = await mkdtemp(path.join(tmpdir(), "webmcp-today-public-host-"));
  temporaryDirectories.push(homeDirectory);
  const packageRoot = await mkdtemp(path.join(process.cwd(), ".native-host-package-"));
  temporaryDirectories.push(packageRoot);
  await fs.mkdir(path.join(packageRoot, "dist"));
  await writeFile(path.join(packageRoot, "dist", "native-host.standalone.js"), "export {};\n");
  return {
    homeDirectory,
    deps: {
      ...createNativeHostInstallerDeps(),
      platform: "darwin",
      homedir: () => homeDirectory,
      packageRoot,
      ...overrides,
    },
  };
}
