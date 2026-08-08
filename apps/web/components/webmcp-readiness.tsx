"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Loader2Icon } from "lucide-react";
import { pingExtension, resetExtensionBridgeProbe } from "@/lib/extension-bridge";
import { extensionCheckpoint, type ExtensionCheckpoint } from "@/lib/onboarding-preflight";

type ExtensionState = "waiting" | "checking" | ExtensionCheckpoint;

export function WebMcpReadinessView({
  extension,
  onCheckAgain,
}: {
  extension: ExtensionState;
  onCheckAgain: () => void;
}) {
  const pending = extension === "waiting" || extension === "checking";

  return (
    <section
      className="mt-6 rounded-2xl border bg-card px-4 py-3"
      aria-live="polite"
      aria-label="Extension readiness"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {pending ? (
          <Loader2Icon
            className="size-4 shrink-0 animate-spin text-muted-foreground"
            role="status"
            aria-label="Checking"
          />
        ) : extension === "ready" ? (
          <CircleCheck className="size-4 shrink-0 text-brand" aria-hidden />
        ) : (
          <CircleAlert className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <p className={extension === "ready" ? undefined : "text-muted-foreground"}>
          {pending && "Checking for the WebMCP Today extension…"}
          {extension === "ready" && "WebMCP Today extension connected."}
          {extension === "absent" &&
            "No WebMCP Today extension answered this page yet — load it, then check again."}
          {extension === "unreadable" &&
            "The extension answered but cannot read its storage — reinstall or update it."}
        </p>
        {!pending && extension !== "ready" && (
          <button
            type="button"
            onClick={onCheckAgain}
            className="shrink-0 text-foreground underline underline-offset-4"
          >
            Check again
          </button>
        )}
      </div>
    </section>
  );
}

export function WebMcpReadiness() {
  const [extension, setExtension] = useState<ExtensionState>("waiting");

  const checkReadiness = useCallback(async () => {
    setExtension("checking");
    resetExtensionBridgeProbe();
    setExtension(extensionCheckpoint(await pingExtension()));
  }, []);

  useEffect(() => {
    void checkReadiness();
  }, [checkReadiness]);

  return <WebMcpReadinessView extension={extension} onCheckAgain={() => void checkReadiness()} />;
}
