"use client";

import { useEffect, useState } from "react";
import { pingExtension } from "@/lib/extension-bridge";

type UpdateDetails = {
  installed: string | undefined;
  latest: string;
  releaseUrl: string;
  downloadUrl: string;
  checksumsUrl: string;
};

export function ExtensionUpdateDetails() {
  const [details, setDetails] = useState<UpdateDetails>();

  useEffect(() => {
    void (async () => {
      try {
        const [releaseResponse, extension] = await Promise.all([
          fetch("/api/extension/latest"),
          pingExtension(),
        ]);
        if (!releaseResponse.ok) return;
        const release = await releaseResponse.json();
        if (
          typeof release !== "object" ||
          release === null ||
          typeof release.version !== "string" ||
          typeof release.releaseUrl !== "string" ||
          typeof release.downloadUrl !== "string" ||
          typeof release.checksumsUrl !== "string"
        ) {
          return;
        }
        setDetails({
          installed: extension.status === "ok" ? extension.data.extensionVersion : undefined,
          latest: release.version,
          releaseUrl: release.releaseUrl,
          downloadUrl: release.downloadUrl,
          checksumsUrl: release.checksumsUrl,
        });
      } catch {
        // The replacement instructions stand alone if either optional lookup fails.
      }
    })();
  }, []);

  if (details === undefined) return null;
  return (
    <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
      {details.installed !== undefined && (
        <p className="font-mono text-xs">
          Installed: {details.installed}. Latest stable: {details.latest}.
        </p>
      )}
      <p className="mt-2">
        <a href={details.releaseUrl} className="text-foreground underline underline-offset-4">
          Release notes for {details.latest}
        </a>{" "}
        ·{" "}
        <a href={details.downloadUrl} className="text-foreground underline underline-offset-4">
          Download the versioned ZIP
        </a>{" "}
        ·{" "}
        <a href={details.checksumsUrl} className="text-foreground underline underline-offset-4">
          SHA256SUMS
        </a>
      </p>
    </div>
  );
}
