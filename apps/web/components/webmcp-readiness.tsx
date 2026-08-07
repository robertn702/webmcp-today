"use client";

import React, { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pingExtension, resetExtensionBridgeProbe } from "@/lib/extension-bridge";
import { extensionCheckpoint, type ExtensionCheckpoint } from "@/lib/onboarding-preflight";

function Checkpoint({
  complete,
  title,
  children,
}: {
  complete: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="relative">
      <span
        aria-label={complete ? "Complete" : "Not complete"}
        className="absolute -left-[1.95rem] z-10 flex size-5 items-center justify-center rounded-full border border-background bg-background"
      >
        {complete ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-contrast">
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
        ) : (
          <span className="size-3 rounded-full border border-border bg-background" />
        )}
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </li>
  );
}

export function WebMcpReadinessView({
  extension,
  onCheckAgain,
}: {
  extension: "waiting" | "checking" | ExtensionCheckpoint;
  onCheckAgain: () => void;
}) {
  return (
    <section className="mt-8 rounded-2xl border bg-card p-5" aria-labelledby="readiness-heading">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">Readiness</p>
      <h2 id="readiness-heading" className="mt-2 font-display text-2xl tracking-tight">
        Check this browser first
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        This check uses the extension&apos;s own bridge API on this page. It does not inspect your
        MCP client or native messaging setup.
      </p>

      <ol className="mt-5 flex flex-col gap-5 border-l-2 border-brand/30 pl-5">
        <Checkpoint complete={extension === "ready"} title="WebMCP Today is connected">
          {extension === "waiting" && "Load the extension, then check again."}
          {extension === "checking" && "Checking the installed extension…"}
          {extension === "ready" && "The extension answered this site and its storage is readable."}
          {extension === "absent" && (
            <>
              No configured WebMCP Today extension answered this site. Load the release ZIP from the
              setup instructions, then check again.
            </>
          )}
          {extension === "unreadable" &&
            "The extension answered but cannot read its storage. Reinstall or update it, then check again."}
        </Checkpoint>
      </ol>

      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        The WebMCP testing flag is only needed for Chrome&apos;s own native agent. This bridge path
        works without it: the extension&apos;s built-in fallback registers tools on pages even where
        the flag is off.
      </p>

      <Button className="mt-5" variant="outline" size="sm" onClick={onCheckAgain}>
        Check again
      </Button>
    </section>
  );
}

export function WebMcpReadiness() {
  const [extension, setExtension] = useState<"waiting" | "checking" | ExtensionCheckpoint>(
    "waiting",
  );

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
