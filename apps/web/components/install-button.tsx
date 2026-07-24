"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function InstallButton({ configId }: { configId: string }) {
  const [status, setStatus] = useState<string | null>(null);

  async function install() {
    const res = await fetch(`/api/configs/${configId}/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) setStatus("Installed");
    else if (res.status === 401) setStatus("Sign in to install");
    else setStatus("Install failed");
  }

  async function uninstall() {
    const res = await fetch(`/api/configs/${configId}/install`, { method: "DELETE" });
    if (res.ok) setStatus("Uninstalled");
    else if (res.status === 401) setStatus("Sign in to manage installs");
    else if (res.status === 404) setStatus("Not installed");
    else setStatus("Uninstall failed");
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Button variant="outline" size="sm" onClick={() => void install()}>
        Install
      </Button>
      <Button variant="outline" size="sm" onClick={() => void uninstall()}>
        Uninstall
      </Button>
      {status && <span className="text-xs text-muted-foreground">{status}</span>}
    </div>
  );
}
