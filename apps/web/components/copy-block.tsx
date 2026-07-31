"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyBlock({ children, label = "Copy" }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    if (!copied && !copyFailed) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
      setCopyFailed(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [copied, copyFailed]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopyFailed(false);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border bg-muted/50">
      <div className="flex justify-end border-b px-2 py-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? "Copied" : copyFailed ? "Copy failed" : label}
        </Button>
      </div>
      <pre className="overflow-x-auto px-3 py-3 font-mono text-xs whitespace-pre-wrap">
        {children}
      </pre>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard." : copyFailed ? "Copy failed." : ""}
      </span>
    </div>
  );
}
