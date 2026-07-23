"use client";

import { useState } from "react";

export function VoteButtons({ configId }: { configId: string }) {
  const [status, setStatus] = useState<string | null>(null);

  async function vote(value: 1 | -1) {
    const res = await fetch(`/api/configs/${configId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (res.ok) {
      setStatus("Vote recorded");
    } else if (res.status === 401) {
      setStatus("Sign in to vote");
    } else {
      setStatus("Vote failed");
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => void vote(1)}
        className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-100"
      >
        👍 Works
      </button>
      <button
        onClick={() => void vote(-1)}
        className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-100"
      >
        👎 Broken
      </button>
      {status && <span className="text-xs text-stone-500">{status}</span>}
    </div>
  );
}
