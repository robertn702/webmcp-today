"use client";

import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";

// TODO: this renders Install and Uninstall unconditionally and never reads the
// current install state, so the labels can't reflect reality — it needs the
// caller to pass install state (or fetch it) to render the correct single action.

/** PUT /api/packages/:id/install response — see app/api/packages/[id]/install/route.ts. */
const installResponseSchema = z.object({ version: z.number() });

type Status = { text: string; href?: string };

export function InstallButton({ packageId }: { packageId: string }) {
  const [status, setStatus] = useState<Status | null>(null);

  async function install() {
    const res = await fetch(`/api/packages/${packageId}/install`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const body: unknown = await res.json().catch(() => null);
      const parsed = installResponseSchema.safeParse(body);
      setStatus({
        text: parsed.success ? `Installed, pinned to v${parsed.data.version}` : "Installed",
      });
    } else if (res.status === 401) {
      setStatus({ text: "Sign in to install", href: "/auth" });
    } else {
      setStatus({ text: `Install failed (${res.status}). Try again.` });
    }
  }

  async function uninstall() {
    const res = await fetch(`/api/packages/${packageId}/install`, { method: "DELETE" });
    if (res.ok) setStatus({ text: "Uninstalled" });
    else if (res.status === 401) setStatus({ text: "Sign in to manage installs", href: "/auth" });
    else if (res.status === 404) setStatus({ text: "Not installed" });
    else setStatus({ text: `Uninstall failed (${res.status}). Try again.` });
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Button variant="outline" size="sm" onClick={() => void install()}>
        Install
      </Button>
      <Button variant="outline" size="sm" onClick={() => void uninstall()}>
        Uninstall
      </Button>
      {status &&
        (status.href ? (
          <Link href={status.href} className="text-xs text-foreground underline underline-offset-4">
            {status.text}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">{status.text}</span>
        ))}
    </div>
  );
}
