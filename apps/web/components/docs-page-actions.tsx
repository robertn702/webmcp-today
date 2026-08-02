"use client";

import { Check, Copy, FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function DocsPageActions({ markdown, markdownUrl }: { markdown: string; markdownUrl: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyMarkdown() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => void copyMarkdown()}>
        {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
        {copied ? "Copied" : "Copy Markdown"}
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={markdownUrl} prefetch={false}>
          <FileText data-icon="inline-start" />
          View Markdown
        </Link>
      </Button>
    </div>
  );
}
