"use client";

import { createConfigSchema } from "@robertn702/webmcp-cafe-schema";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
      setError("Sign in (Settings) or use an API key to submit.");
    } else {
      setError(`Submit failed (${res.status}): ${await res.text()}`);
    }
  }

  return (
    <div>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={20}
        spellCheck={false}
        placeholder='{"domain": "example.com", "urlPattern": "example.com", "title": "...", "description": "...", "tools": []}'
        className="w-full rounded border border-stone-300 bg-white p-3 font-mono text-xs"
      />
      {error && (
        <pre className="mt-2 whitespace-pre-wrap rounded bg-red-50 p-3 text-xs text-red-800">
          {error}
        </pre>
      )}
      <button
        onClick={() => void submit()}
        disabled={busy}
        className="mt-3 rounded bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit config"}
      </button>
    </div>
  );
}
