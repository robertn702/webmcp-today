"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

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
      <Button variant="outline" size="sm" onClick={() => void vote(1)}>
        👍 Works
      </Button>
      <Button variant="outline" size="sm" onClick={() => void vote(-1)}>
        👎 Broken
      </Button>
      {status && <span className="text-xs text-muted-foreground">{status}</span>}
    </div>
  );
}
