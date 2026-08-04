import { access, chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LOCAL_BRIDGE_NATIVE_HOST_NAME } from "@webmcp-today/schema";
import {
  developmentExtensionId,
  nativeHostPaths,
  nativeHostWrapper,
  writeNativeHostInstallation,
} from "../bin/install-native-host.mjs";

const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("macOS native-host installer artifacts", () => {
  it("writes a matching host-name manifest and executable absolute-path wrapper", async () => {
    const homeDirectory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(homeDirectory);
    const nativeHostPath = join(homeDirectory, "native-host.js");
    await writeFile(nativeHostPath, "export {};\n");

    const paths = await writeNativeHostInstallation({
      extensionId,
      homeDirectory,
      nodePath: process.execPath,
      nativeHostPath,
    });
    const manifest = JSON.parse(await readFile(paths.manifestPath, "utf8"));
    const wrapper = await readFile(paths.wrapperPath, "utf8");
    const wrapperMode = (await stat(paths.wrapperPath)).mode & 0o777;
    const manifestMode = (await stat(paths.manifestPath)).mode & 0o777;

    await access(process.execPath, constants.X_OK);
    expect(paths.manifestPath).toMatch(new RegExp(`${LOCAL_BRIDGE_NATIVE_HOST_NAME}\\.json$`));
    expect(manifest).toEqual({
      name: LOCAL_BRIDGE_NATIVE_HOST_NAME,
      description: "WebMCP Today local bridge",
      path: paths.wrapperPath,
      type: "stdio",
      allowed_origins: [`chrome-extension://${extensionId}/`],
    });
    expect(manifest.name).toBe(
      paths.manifestPath
        .split("/")
        .at(-1)
        ?.replace(/\.json$/, ""),
    );
    expect(wrapper).toBe(nativeHostWrapper({ nodePath: process.execPath, nativeHostPath }));
    expect(wrapper).toContain("#!/bin/sh\nexec '");
    expect(wrapperMode).toBe(0o755);
    expect(manifestMode).toBe(0o644);

    await chmod(paths.wrapperPath, 0o700);
    await writeNativeHostInstallation({
      extensionId,
      homeDirectory,
      nodePath: process.execPath,
      nativeHostPath,
    });
    expect((await stat(paths.wrapperPath)).mode & 0o777).toBe(0o755);
  });

  it("uses the schema host name for the Chrome manifest path", () => {
    const paths = nativeHostPaths("/Users/example");

    expect(paths.manifestPath).toBe(
      "/Users/example/Library/Application Support/Google/Chrome/NativeMessagingHosts/today.webmcp.bridge.json",
    );
  });

  it("uses Brave's native-messaging and Chrome compatibility directories when requested", () => {
    const paths = nativeHostPaths("/Users/example", "brave");

    expect(paths.manifestPath).toBe(
      "/Users/example/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/today.webmcp.bridge.json",
    );
    expect(paths.manifestPaths).toEqual([
      "/Users/example/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/today.webmcp.bridge.json",
      "/Users/example/Library/Application Support/Google/Chrome/NativeMessagingHosts/today.webmcp.bridge.json",
    ]);
  });

  it("writes Brave's compatibility manifest with the same exact-origin allowlist", async () => {
    const homeDirectory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(homeDirectory);
    const nativeHostPath = join(homeDirectory, "native-host.js");
    await writeFile(nativeHostPath, "export {};\n");

    const paths = await writeNativeHostInstallation({
      extensionId,
      homeDirectory,
      nodePath: process.execPath,
      nativeHostPath,
      browser: "brave",
    });
    const manifests = await Promise.all(
      paths.manifestPaths.map((manifestPath) => readFile(manifestPath, "utf8")),
    );

    expect(manifests[1]).toBe(manifests[0]);
    expect(JSON.parse(manifests[1])).toEqual({
      name: LOCAL_BRIDGE_NATIVE_HOST_NAME,
      description: "WebMCP Today local bridge",
      path: paths.wrapperPath,
      type: "stdio",
      allowed_origins: [`chrome-extension://${extensionId}/`],
    });
  });

  it("uses the documented development identity", () => {
    expect(developmentExtensionId).toBe("peaiababjjehplphfkhefdlgefaaemkl");
  });

  it("fails with the documented build command when the native host has not been built", async () => {
    const homeDirectory = await mkdtemp(join(tmpdir(), "webmcp-today-native-host-"));
    temporaryDirectories.push(homeDirectory);

    await expect(
      writeNativeHostInstallation({
        extensionId,
        homeDirectory,
        nodePath: process.execPath,
        nativeHostPath: join(homeDirectory, "missing-native-host.js"),
      }),
    ).rejects.toThrow("bunx turbo run build --filter");
  });

  it("rejects invalid extension IDs and relative interpreter paths", async () => {
    await expect(
      writeNativeHostInstallation({
        extensionId: "invalid",
        homeDirectory: "/Users/example",
        nodePath: process.execPath,
        nativeHostPath: "/tmp/native-host.js",
      }),
    ).rejects.toThrow("32-character Chrome extension ID");

    await expect(
      writeNativeHostInstallation({
        extensionId,
        homeDirectory: "/Users/example",
        nodePath: "node",
        nativeHostPath: "/tmp/native-host.js",
      }),
    ).rejects.toThrow("interpreter path must be absolute");
  });

  it("shell-quotes paths with apostrophes", () => {
    expect(
      nativeHostWrapper({
        nodePath: "/usr/local/bin/node",
        nativeHostPath: "/Users/Robert's Mac/webmcp-today/native-host.js",
      }),
    ).toBe(
      "#!/bin/sh\nexec '/usr/local/bin/node' '/Users/Robert'\"'\"'s Mac/webmcp-today/native-host.js'\n",
    );
  });
});
