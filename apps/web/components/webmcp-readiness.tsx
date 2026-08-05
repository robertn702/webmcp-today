"use client";

import React, { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pingExtension, resetExtensionBridgeProbe } from "@/lib/extension-bridge";
import {
  browserGuidance,
  extensionCheckpoint,
  webMcpCapabilities,
  type BrowserGuidance,
  type ExtensionCheckpoint,
} from "@/lib/onboarding-preflight";

type CheckStatus = "checking" | "waiting" | "unavailable" | "ready";

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

function SettingsPath({ guidance }: { guidance: BrowserGuidance }) {
  async function copySettingsPath() {
    if (guidance.family === "other") return;
    try {
      await navigator.clipboard.writeText(guidance.settingsPath);
      toast.success("Settings path copied");
    } catch {
      toast.error("Could not copy settings path");
    }
  }

  if (guidance.family === "other") {
    return (
      <>
        This setup currently documents macOS Chrome and Brave. Use a current supported Chromium
        browser, then return here and let the runtime check decide.
      </>
    );
  }

  return (
    <>
      Paste this path into the address bar, enable WebMCP testing, and relaunch {guidance.label}:{" "}
      <span className="inline-flex items-center gap-1 align-middle">
        <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
          {guidance.settingsPath}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Copy ${guidance.settingsPath}`}
          className="size-6"
          onClick={() => void copySettingsPath()}
        >
          <Copy className="size-3.5" aria-hidden />
        </Button>
      </span>
      .
    </>
  );
}

export function WebMcpReadinessView({
  registration,
  consumer,
  extension,
  guidance,
  onCheckAgain,
}: {
  registration: CheckStatus;
  consumer: CheckStatus;
  extension: "waiting" | "checking" | ExtensionCheckpoint;
  guidance: BrowserGuidance;
  onCheckAgain: () => void;
}) {
  return (
    <section className="mt-8 rounded-2xl border bg-card p-5" aria-labelledby="readiness-heading">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">Readiness</p>
      <h2 id="readiness-heading" className="mt-2 font-display text-2xl tracking-tight">
        Check this browser first
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        These checks use this page&apos;s actual browser and extension APIs. They do not inspect
        your MCP client or native messaging setup.
      </p>

      <ol className="mt-5 flex flex-col gap-5 border-l-2 border-brand/30 pl-5">
        <Checkpoint
          complete={registration === "ready"}
          title="A compatible WebMCP runtime is present"
        >
          {registration === "checking" &&
            "Checking whether the extension can register WebMCP tools…"}
          {registration === "ready" &&
            "This runtime exposes the registration API the extension uses."}
          {registration === "unavailable" && <SettingsPath guidance={guidance} />}
        </Checkpoint>

        <Checkpoint
          complete={consumer === "ready"}
          title="WebMCP tool discovery and calls are available"
        >
          {consumer === "waiting" && "Finish the runtime check first."}
          {consumer === "checking" && "Checking the WebMCP consumer APIs…"}
          {consumer === "ready" &&
            "This browser can list and execute live WebMCP tools through the bridge."}
          {consumer === "unavailable" && (
            <>
              The local bridge needs WebMCP&apos;s <code>getTools()</code> and{" "}
              <code>executeTool()</code> APIs. <SettingsPath guidance={guidance} />
            </>
          )}
        </Checkpoint>

        <Checkpoint complete={extension === "ready"} title="WebMCP Today is connected">
          {extension === "waiting" &&
            "Finish the runtime checks, then load the extension and check again."}
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

      <Button className="mt-5" variant="outline" size="sm" onClick={onCheckAgain}>
        Check again
      </Button>
    </section>
  );
}

export function WebMcpReadiness() {
  const [registration, setRegistration] = useState<CheckStatus>("checking");
  const [consumer, setConsumer] = useState<CheckStatus>("waiting");
  const [extension, setExtension] = useState<"waiting" | "checking" | ExtensionCheckpoint>(
    "waiting",
  );
  const [guidance, setGuidance] = useState<BrowserGuidance>({ family: "other" });

  const checkReadiness = useCallback(async () => {
    setRegistration("checking");
    setConsumer("waiting");
    setExtension("waiting");
    setGuidance(browserGuidance(navigator));

    const capabilities = webMcpCapabilities(document, navigator);
    setRegistration(capabilities.registration ? "ready" : "unavailable");
    if (!capabilities.registration) return;

    setConsumer("checking");
    setConsumer(capabilities.consumer ? "ready" : "unavailable");
    if (!capabilities.consumer) return;

    setExtension("checking");
    resetExtensionBridgeProbe();
    setExtension(extensionCheckpoint(await pingExtension()));
  }, []);

  useEffect(() => {
    void checkReadiness();
  }, [checkReadiness]);

  return (
    <WebMcpReadinessView
      registration={registration}
      consumer={consumer}
      extension={extension}
      guidance={guidance}
      onCheckAgain={() => void checkReadiness()}
    />
  );
}
