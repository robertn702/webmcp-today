"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InstallFailure, InstallState } from "@robertn702/webmcp-cafe-schema";
import { Button } from "@/components/ui/button";
import {
  installPackage,
  listInstalls,
  pingExtension,
  uninstallPackage,
} from "@/lib/extension-bridge";
import { cn } from "@/lib/utils";

// Client island for the extension install bridge. One correct action per
// state; the bridge (lib/extension-bridge.ts) owns probing + protocol
// validation. Local state only — the bridge is not a cache-worthy resource.

type ButtonState =
  | { kind: "checking" }
  | { kind: "absent" }
  | { kind: "not-installed" }
  | { kind: "busy" }
  | { kind: "installed"; version: number; state: InstallState }
  | { kind: "outdated"; installedVersion: number; state: InstallState }
  | { kind: "failed"; reason: InstallFailure };

const FAILURE_TEXT: Record<InstallFailure, string> = {
  "not-found": "The registry couldn't find this version.",
  "invalid-body": "The registry served a package the extension couldn't read.",
  "id-mismatch": "The registry served the wrong package — install refused.",
  "hash-mismatch": "The package's content didn't match its fingerprint — install refused.",
  revoked: "This package was pulled from the registry.",
  "revocation-unavailable": "Couldn't reach the registry's safety list — try again.",
  "engine-too-old": "Update the extension to install this package.",
  quota: "Browser storage is full.",
  network: "Couldn't reach the registry — try again.",
  "storage-unreadable": "The extension's storage is unreadable — reinstall the extension.",
  "bad-request": "The extension didn't understand the request — update it.",
};

const STATE_BADGE: Record<InstallState, string | null> = {
  ok: null,
  broken: "broken — reinstall",
  revoked: "pulled by the registry",
  "engine-too-old": "needs an extension update",
};

export function InstallButton({
  packageId,
  versionId,
  version,
  autoFocus = false,
}: {
  packageId: string;
  versionId: string;
  version: number;
  /** Surface this button for a handoff link (e.g. `?install=<versionId>`). */
  autoFocus?: boolean;
}) {
  const [status, setStatus] = useState<ButtonState>({ kind: "checking" });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [autoFocus]);

  const refresh = useCallback(async () => {
    const ping = await pingExtension();
    if (ping.status !== "ok") {
      setStatus({ kind: "absent" });
      return;
    }
    if (!ping.data.storageReadable) {
      setStatus({ kind: "failed", reason: "storage-unreadable" });
      return;
    }
    const installs = await listInstalls();
    if (installs.status !== "ok") {
      setStatus({ kind: "absent" });
      return;
    }
    const entry = installs.data.installs.find((i) => i.packageId === packageId);
    if (entry === undefined) {
      setStatus({ kind: "not-installed" });
    } else if (entry.versionId === versionId) {
      setStatus({ kind: "installed", version: entry.version, state: entry.state });
    } else {
      setStatus({ kind: "outdated", installedVersion: entry.version, state: entry.state });
    }
  }, [packageId, versionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function install() {
    setStatus({ kind: "busy" });
    const result = await installPackage(packageId, versionId);
    if (result.status === "ok") {
      if (result.data.ok) {
        setStatus({ kind: "installed", version: result.data.version, state: "ok" });
      } else {
        setStatus({ kind: "failed", reason: result.data.reason });
      }
    } else {
      setStatus({ kind: "absent" });
    }
  }

  async function uninstall() {
    setStatus({ kind: "busy" });
    const result = await uninstallPackage(packageId);
    if (result.status !== "ok") {
      setStatus({ kind: "absent" });
      return;
    }
    if (result.data.ok) setStatus({ kind: "not-installed" });
    else if (result.data.reason === "storage-unreadable") {
      setStatus({ kind: "failed", reason: "storage-unreadable" });
    } else await refresh();
  }

  const badge = (state: InstallState): string | null => STATE_BADGE[state];

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex items-center gap-2 rounded-lg text-sm",
        autoFocus && "ring-2 ring-brand ring-offset-2 ring-offset-background",
      )}
    >
      {status.kind === "checking" && (
        <span className="text-xs text-muted-foreground">Checking for the extension…</span>
      )}

      {status.kind === "absent" && (
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href="/extension">Install the extension</Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            Installs happen in your browser via the extension.
          </span>
        </>
      )}

      {status.kind === "not-installed" && (
        <Button variant="outline" size="sm" onClick={() => void install()}>
          Install v{version}
        </Button>
      )}

      {status.kind === "busy" && (
        <Button variant="outline" size="sm" disabled>
          Working…
        </Button>
      )}

      {status.kind === "installed" && (
        <>
          <span className="text-xs text-muted-foreground">
            Installed — v{status.version}
            {badge(status.state) !== null && ` · ${badge(status.state)}`}
          </span>
          <Button variant="outline" size="sm" onClick={() => void uninstall()}>
            Uninstall
          </Button>
        </>
      )}

      {status.kind === "outdated" && (
        <>
          <span className="text-xs text-muted-foreground">
            Installed v{status.installedVersion}
            {badge(status.state) !== null && ` · ${badge(status.state)}`}
          </span>
          <Button variant="outline" size="sm" onClick={() => void install()}>
            Update to v{version}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void uninstall()}>
            Uninstall
          </Button>
        </>
      )}

      {status.kind === "failed" && (
        <>
          <Button variant="outline" size="sm" onClick={() => void install()}>
            Retry install
          </Button>
          <span className="text-xs text-muted-foreground">{FAILURE_TEXT[status.reason]}</span>
        </>
      )}
    </div>
  );
}
