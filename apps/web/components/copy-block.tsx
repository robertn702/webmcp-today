"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({ text, label }: { text: string; label?: string }) {
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
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  const stateLabel = copied ? "Copied" : copyFailed ? "Copy failed" : (label ?? "Copy");

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={label ? "sm" : "icon-sm"}
        aria-label={label ? undefined : stateLabel}
        onClick={() => void copy()}
      >
        {copied ? (
          <Check data-icon={label ? "inline-start" : undefined} />
        ) : (
          <Copy data-icon={label ? "inline-start" : undefined} />
        )}
        {label ? stateLabel : null}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard." : copyFailed ? "Copy failed." : ""}
      </span>
    </>
  );
}

export function CopyBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="relative mt-3 overflow-hidden rounded-lg border bg-muted/50">
      {label ? (
        <div className="flex items-center justify-between border-b px-3 py-1.5">
          <span className="font-mono text-xs text-muted-foreground">{label}</span>
          <CopyButton text={children} />
        </div>
      ) : (
        <div className="absolute top-2 right-2">
          <CopyButton text={children} />
        </div>
      )}
      <pre
        className={cn(
          "overflow-x-auto px-3 py-3 font-mono text-xs whitespace-pre-wrap",
          label ? null : "pr-11",
        )}
      >
        {children}
      </pre>
    </div>
  );
}
