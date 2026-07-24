"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function VerifyButton({ configId, toolName }: { configId: string; toolName: string }) {
  const [status, setStatus] = useState<string | null>(null);

  async function verify() {
    const res = await fetch(`/api/configs/${configId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolName }),
    });
    if (res.ok) setStatus("Verified — snapshot frozen");
    else if (res.status === 401) setStatus("Sign in to verify");
    else if (res.status === 403) setStatus("Can't verify your own config");
    else setStatus("Verification failed");
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="outline" size="xs" onClick={() => void verify()}>
        I tested this — verify
      </Button>
      {status && <span className="text-xs text-muted-foreground">{status}</span>}
    </span>
  );
}
