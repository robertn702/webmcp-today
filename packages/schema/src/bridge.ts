import { z } from "zod";

/**
 * Page↔extension bridge wire protocol, exchanged over
 * `runtime.onMessageExternal` (see docs/local-first-installs.md §4). Both
 * sides zod-validate against these schemas so the shapes can't drift between
 * `apps/web` and `apps/extension`.
 */
export const BRIDGE_PROTOCOL_VERSION = 1;

const installFailureSchema = z.enum([
  "not-found",
  "invalid-body",
  "id-mismatch",
  // The served apiContentHash didn't match a recomputation over the served
  // api block — the body isn't what its identifier claims, so the install is
  // refused rather than stored.
  "hash-mismatch",
  "revoked",
  "revocation-unavailable",
  "engine-too-old",
  "quota",
  "network",
  "storage-unreadable",
  "bad-request",
]);

const installStateSchema = z.enum(["ok", "broken", "revoked", "engine-too-old"]);

// page → extension

export const bridgePingRequestSchema = z.object({
  v: z.literal(BRIDGE_PROTOCOL_VERSION),
  type: z.literal("ping"),
});

export const bridgeInstallRequestSchema = z.object({
  v: z.literal(BRIDGE_PROTOCOL_VERSION),
  type: z.literal("install"),
  packageId: z.string(),
  versionId: z.string(),
});

export const bridgeUninstallRequestSchema = z.object({
  v: z.literal(BRIDGE_PROTOCOL_VERSION),
  type: z.literal("uninstall"),
  packageId: z.string(),
});

export const bridgeListInstallsRequestSchema = z.object({
  v: z.literal(BRIDGE_PROTOCOL_VERSION),
  type: z.literal("list-installs"),
});

export const bridgeRequestSchema = z.discriminatedUnion("type", [
  bridgePingRequestSchema,
  bridgeInstallRequestSchema,
  bridgeUninstallRequestSchema,
  bridgeListInstallsRequestSchema,
]);

// extension → page

export const bridgePingResponseSchema = z.object({
  ok: z.literal(true),
  protocol: z.number().int().min(1),
  engine: z.number().int().positive(),
  extensionVersion: z.string(),
  storageReadable: z.boolean(),
});

const installReplacedSchema = z.object({
  versionId: z.string(),
  version: z.number().int().min(1),
});

export const bridgeInstallResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    packageId: z.string(),
    versionId: z.string(),
    version: z.number().int().min(1),
    // Present when this install replaced an existing pin — installing is an
    // upsert, and callers need to know a version "moved" rather than being new.
    replaced: installReplacedSchema.optional(),
  }),
  z.object({
    ok: z.literal(false),
    reason: installFailureSchema,
  }),
]);

export const bridgeUninstallResponseSchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    reason: z.enum(["not-installed", "storage-unreadable"]),
  }),
]);

export const bridgeListInstallsResponseSchema = z.object({
  ok: z.literal(true),
  installs: z.array(
    z.object({
      packageId: z.string(),
      versionId: z.string(),
      version: z.number().int().min(1),
      title: z.string(),
      domain: z.string(),
      installedAt: z.iso.datetime(),
      state: installStateSchema,
    }),
  ),
});

export type BridgeRequest = z.infer<typeof bridgeRequestSchema>;
export type BridgePingRequest = z.infer<typeof bridgePingRequestSchema>;
export type BridgeInstallRequest = z.infer<typeof bridgeInstallRequestSchema>;
export type BridgeUninstallRequest = z.infer<typeof bridgeUninstallRequestSchema>;
export type BridgeListInstallsRequest = z.infer<typeof bridgeListInstallsRequestSchema>;
export type BridgePingResponse = z.infer<typeof bridgePingResponseSchema>;
export type BridgeInstallResponse = z.infer<typeof bridgeInstallResponseSchema>;
export type BridgeUninstallResponse = z.infer<typeof bridgeUninstallResponseSchema>;
export type BridgeListInstallsResponse = z.infer<typeof bridgeListInstallsResponseSchema>;
export type InstallFailure = z.infer<typeof installFailureSchema>;
export type InstallState = z.infer<typeof installStateSchema>;
