import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createNativeHostInstallerDeps,
  developmentExtensionId,
} from "../src/native-host-installer.js";
import { confirmApproval, createSetupToolHandlers } from "../src/setup-tools.js";

describe("confirmApproval schema", () => {
  it('parses boolean true, tolerates string "true", and leaves other values gated', () => {
    const schema = z.object({ confirm: confirmApproval("the test action") });
    expect(schema.parse({ confirm: true })).toEqual({ confirm: true });
    // MCP clients can degrade `const: true` to the string "true" in tool calls.
    expect(schema.parse({ confirm: "true" })).toEqual({ confirm: true });
    expect(schema.parse({ confirm: false })).toEqual({ confirm: false });
    expect(schema.parse({})).toEqual({});
    expect(schema.safeParse({ confirm: "yes" }).success).toBe(false);
  });
});

describe("bridge setup MCP tool handlers", () => {
  it("requires explicit confirmation for setup and uninstall", async () => {
    const install = vi.fn();
    const uninstall = vi.fn();
    const handlers = createSetupToolHandlers(createNativeHostInstallerDeps(), {
      install,
      status: vi.fn(),
      uninstall,
    });

    await expect(handlers.setup({ browser: "chrome" })).resolves.toMatchObject({
      content: [{ text: expect.stringContaining("confirm: true") }],
    });
    await expect(handlers.uninstall({ browser: "chrome" })).resolves.toMatchObject({
      content: [{ text: expect.stringContaining("confirm: true") }],
    });
    expect(install).not.toHaveBeenCalled();
    expect(uninstall).not.toHaveBeenCalled();
  });

  it("returns setup, status, and uninstall results as MCP text", async () => {
    const handlers = createSetupToolHandlers(createNativeHostInstallerDeps(), {
      install: vi.fn(async () => ({
        installed: true,
        browser: "chrome",
        manifestPaths: ["manifest"],
      })),
      status: vi.fn(async () => ({ ready: true, bridgeConfig: { present: true } })),
      uninstall: vi.fn(async () => ({ browser: "chrome", removed: ["manifest"], notFound: [] })),
    });

    await expect(handlers.setup({ browser: "chrome", confirm: true })).resolves.toMatchObject({
      content: [{ text: expect.stringContaining('"installed": true') }],
    });
    await expect(handlers.status({ browser: "chrome" })).resolves.toMatchObject({
      content: [{ text: expect.stringContaining('"ready": true') }],
    });
    await expect(handlers.uninstall({ browser: "chrome", confirm: true })).resolves.toMatchObject({
      content: [{ text: expect.stringContaining('"removed"') }],
    });
  });

  it("surfaces installer failures as MCP tool errors", async () => {
    const handlers = createSetupToolHandlers(createNativeHostInstallerDeps(), {
      install: vi.fn(async () => Promise.reject(new Error("macOS only"))),
      status: vi.fn(),
      uninstall: vi.fn(),
    });

    await expect(handlers.setup({ browser: "chrome", confirm: true })).resolves.toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining("macOS only") }],
    });
  });

  it("passes only the documented development extension override", async () => {
    const install = vi.fn(async () => ({ installed: true }));
    const handlers = createSetupToolHandlers(createNativeHostInstallerDeps(), {
      install,
      status: vi.fn(),
      uninstall: vi.fn(),
    });

    await handlers.setup({ browser: "chrome", confirm: true, extensionId: developmentExtensionId });
    expect(install).toHaveBeenCalledWith(expect.anything(), {
      browser: "chrome",
      extensionId: developmentExtensionId,
    });
  });
});
