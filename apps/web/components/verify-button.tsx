"use client";

import { useState } from "react";

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
      <button
        onClick={() => void verify()}
        className="rounded border border-green-700 px-1.5 py-0.5 text-xs text-green-800 hover:bg-green-50"
      >
        I tested this — verify
      </button>
      {status && <span className="text-xs text-stone-500">{status}</span>}
    </span>
  );
}
