"use client";

import { useEffect, useState } from "react";
import { pingExtension } from "@/lib/extension-bridge";
import { extensionReleaseSchema, type ExtensionRelease } from "@/lib/extension-release";

export function ExtensionUpdateDetails() {
  const [release, setRelease] = useState<ExtensionRelease>();
  const [installedVersion, setInstalledVersion] = useState<string>();

  useEffect(() => {
    void (async () => {
      try {
        const releaseResponse = await fetch("/api/extension/latest");
        if (!releaseResponse.ok) return;
        const parsedRelease = extensionReleaseSchema.safeParse(await releaseResponse.json());
        if (parsedRelease.success) setRelease(parsedRelease.data);
      } catch {
        // The replacement instructions stand alone if the optional release lookup fails.
      }
    })();

    void pingExtension()
      .then((extension) => {
        if (extension.status === "ok") setInstalledVersion(extension.data.extensionVersion);
      })
      .catch(() => {
        // The replacement instructions stand alone if the optional bridge lookup fails.
      });
  }, []);

  if (release === undefined) return null;
  return (
    <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
      {installedVersion !== undefined && (
        <p className="font-mono text-xs">
          Installed: {installedVersion}. Latest stable: {release.version}.
        </p>
      )}
      <p className="mt-2">
        <a href={release.releaseUrl} className="text-foreground underline underline-offset-4">
          Release notes for {release.version}
        </a>{" "}
        ·{" "}
        <a href={release.downloadUrl} className="text-foreground underline underline-offset-4">
          Download the versioned ZIP
        </a>{" "}
        ·{" "}
        <a href={release.checksumsUrl} className="text-foreground underline underline-offset-4">
          SHA256SUMS
        </a>
      </p>
    </div>
  );
}
