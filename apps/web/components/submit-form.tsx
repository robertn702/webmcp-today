"use client";

import { createConfigSchema } from "@robertn702/webmcp-cafe-schema";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function SubmitForm() {
  const router = useRouter();
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      setError("Not valid JSON");
      return;
    }
    const parsed = createConfigSchema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
      return;
    }
    setBusy(true);
    const res = await fetch("/api/configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    setBusy(false);
    if (res.ok) {
      const body: unknown = await res.json();
      const id = typeof body === "object" && body !== null ? Reflect.get(body, "id") : undefined;
      router.push(typeof id === "string" ? `/configs/${id}` : "/");
    } else if (res.status === 401) {
      setError("Sign in or use an API key to submit.");
    } else {
      setError(`Submit failed (${res.status}): ${await res.text()}`);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={20}
        spellCheck={false}
        placeholder='{"domain": "example.com", "urlPatterns": ["*://example.com/*"], "title": "...", "description": "...", "tools": []}'
        className="font-mono text-xs"
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="whitespace-pre-wrap font-mono text-xs">
            {error}
          </AlertDescription>
        </Alert>
      )}
      <Button onClick={() => void submit()} disabled={busy} className="w-fit">
        {busy ? "Submitting…" : "Submit config"}
      </Button>
    </div>
  );
}
