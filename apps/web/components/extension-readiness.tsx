"use client";

import Link from "next/link";
import React, { type ReactNode, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  browserRemediation,
  extensionCheckpoint,
  hasWebMcpCapability,
  type BrowserRemediation,
  type ExtensionCheckpoint,
} from "@/lib/onboarding-preflight";
import { pingExtension, resetExtensionBridgeProbe } from "@/lib/extension-bridge";
import { cn } from "@/lib/utils";

export type BrowserCheckpoint = "checking" | "unavailable" | "ready";
export type ExtensionState = "waiting" | "checking" | ExtensionCheckpoint;

const COMPATIBILITY_HREF =
  "https://github.com/robertn702/webmcp-today/blob/main/docs/browser-compatibility.md";

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
        className={cn(
          "absolute -left-[1.95rem] flex size-5 items-center justify-center rounded-full border text-xs",
          complete
            ? "border-brand bg-brand text-brand-foreground"
            : "border-border bg-background text-muted-foreground",
        )}
      >
        {complete ? "✓" : ""}
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </li>
  );
}

function BrowserInstructions({ remediation }: { remediation: BrowserRemediation }) {
  if (remediation.family === "other") {
    return (
      <>
        Chrome desktop 149+ is the confirmed path. Read the{" "}
        <a href={COMPATIBILITY_HREF} className="text-foreground underline underline-offset-4">
          browser compatibility guide
        </a>{" "}
        for other browsers, then return here to check the actual runtime.
      </>
    );
  }

  return (
    <>
      Copy{" "}
      <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
        {remediation.flagUrl}
      </code>{" "}
      and paste it into the address bar. Enable WebMCP testing, then relaunch {remediation.label}.
      {remediation.isCandidate &&
        " This browser is a candidate only; the runtime check, not its name, confirms support."}
    </>
  );
}

export function ExtensionReadinessView({
  browser,
  extension,
  remediation,
  onCheckAgain,
}: {
  browser: BrowserCheckpoint;
  extension: ExtensionState;
  remediation: BrowserRemediation;
  onCheckAgain: () => void;
}) {
  const ready = browser === "ready" && extension === "ready";

  return (
    <section className="mt-8 rounded-2xl border bg-card p-5" aria-labelledby="readiness-heading">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">
        Before you build
      </p>
      <h2 id="readiness-heading" className="mt-2 font-display text-2xl tracking-tight">
        Check your setup
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        This verifies the browser and extension on this page. You can still use the manual setup
        instructions below at any point.
      </p>

      <ol className="mt-5 flex flex-col gap-5 border-l-2 border-brand/30 pl-5">
        <Checkpoint complete={browser === "ready"} title="WebMCP is available in this browser">
          {browser === "checking" && "Checking for the WebMCP API…"}
          {browser === "ready" && "WebMCP is available. Continue with the extension check."}
          {browser === "unavailable" && (
            <>
              WebMCP must be enabled before tools can register.{" "}
              <BrowserInstructions remediation={remediation} />
            </>
          )}
        </Checkpoint>

        <Checkpoint complete={extension === "ready"} title="The extension can answer this site">
          {extension === "waiting" &&
            "Finish the browser check, then load the extension and check again."}
          {extension === "checking" && "Checking the extension bridge…"}
          {extension === "ready" && "The extension is responding and its storage is readable."}
          {extension === "absent" &&
            "No WebMCP Today extension answered. Build and load it below, then check again."}
          {extension === "unreadable" &&
            "The extension answered but could not read its storage. Reinstall or update it, then check again."}
        </Checkpoint>

        <Checkpoint complete={false} title="Install your first package">
          {ready
            ? "Browse the registry, then use a package page’s Install button."
            : "After the first two checks pass, browse the registry and install a package."}{" "}
          <Link href="/packages" className="text-foreground underline underline-offset-4">
            Browse packages
          </Link>
          .
        </Checkpoint>

        <Checkpoint complete={false} title="Verify tools on the matching target site">
          Visit the site that package matches, then open the extension popup. The popup is
          authoritative: it shows registered tools or a site-blocked status when that site prevents
          WebMCP registration.
        </Checkpoint>
      </ol>

      <Button className="mt-5" variant="outline" size="sm" onClick={onCheckAgain}>
        Check again
      </Button>
    </section>
  );
}

export function ExtensionReadiness() {
  const [browser, setBrowser] = useState<BrowserCheckpoint>("checking");
  const [extension, setExtension] = useState<ExtensionState>("waiting");
  const [remediation, setRemediation] = useState<BrowserRemediation>({ family: "other" });

  const checkReadiness = useCallback(async () => {
    setBrowser("checking");
    setExtension("waiting");

    const browserReady = hasWebMcpCapability(document, navigator);
    setRemediation(browserRemediation(navigator));
    if (!browserReady) {
      setBrowser("unavailable");
      return;
    }

    setBrowser("ready");
    setExtension("checking");
    resetExtensionBridgeProbe();
    setExtension(extensionCheckpoint(await pingExtension()));
  }, []);

  useEffect(() => {
    void checkReadiness();
  }, [checkReadiness]);

  return (
    <ExtensionReadinessView
      browser={browser}
      extension={extension}
      remediation={remediation}
      onCheckAgain={() => void checkReadiness()}
    />
  );
}
