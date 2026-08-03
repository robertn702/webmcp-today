"use client";

import { useSession } from "@better-auth-ui/react";
import { createPackageSchema } from "@robertn702/webmcp-today-schema";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";

/** `href`/`note` are only used by the signed-out case, which needs a real link. */
type FormError = { text: string; href?: string; note?: string };

/** Pull the `{ error }` envelope out of a failed response, falling back to raw text. */
async function readErrorBody(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body: unknown = JSON.parse(text);
    const message = typeof body === "object" && body !== null ? Reflect.get(body, "error") : null;
    return typeof message === "string" ? message : text;
  } catch {
    return text;
  }
}

export function SubmitForm() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession(authClient);
  const [json, setJson] = useState("");
  const [error, setError] = useState<FormError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch (err) {
      // The parser reports the offending position — useless to discard it on a
      // 200-line paste.
      const message = err instanceof Error ? err.message : String(err);
      setError({ text: `Not valid JSON. ${message}` });
      return;
    }
    const parsed = createPackageSchema.safeParse(raw);
    if (!parsed.success) {
      setError({
        text: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"),
      });
      return;
    }
    setBusy(true);
    const res = await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    setBusy(false);
    if (res.ok) {
      const body: unknown = await res.json();
      const id = typeof body === "object" && body !== null ? Reflect.get(body, "id") : undefined;
      router.push(typeof id === "string" ? `/packages/${id}` : "/");
    } else if (res.status === 401) {
      setError({
        text: "Sign in to publish",
        href: "/auth",
        note: "or POST to the API with a Bearer key",
      });
    } else {
      setError({ text: `Publish failed (${res.status}). ${await readErrorBody(res)}` });
    }
  }

  // Render nothing while the session resolves so signed-in users never see
  // the sign-in gate flash. The 401 branch in submit() stays as the fallback
  // for sessions that expire between page load and publish.
  if (sessionPending) {
    return null;
  }

  // The page doubles as publishing docs, so only the form is gated — the
  // format explanation and agent-API section stay readable signed-out.
  if (!session) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-6">
        <h2 className="text-sm font-semibold">Sign in to publish</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Publishing attaches your account to the package and its terms grant, so it needs an
          account. Agents don&apos;t need one. They POST with a Bearer API key (below).
        </p>
        <Button asChild className="w-fit">
          <Link href="/auth/sign-in?redirectTo=%2Fsubmit">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={20}
        spellCheck={false}
        placeholder='{"version": 1, "domain": "acme.com", "urlPatterns": ["*://acme.com/*"], "title": "...", "description": "...", "tools": []}'
        className="font-mono text-xs"
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="whitespace-pre-wrap font-mono text-xs">
            {error.href ? (
              <span>
                <Link href={error.href} className="underline underline-offset-4">
                  {error.text}
                </Link>
                {error.note ? ` ${error.note}` : null}
              </span>
            ) : (
              error.text
            )}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-3">
        <Button
          onClick={() => void submit()}
          disabled={busy || json.trim().length === 0}
          className="w-fit"
        >
          {busy ? "Publishing…" : "Publish package"}
        </Button>
        {/* The grant attaches on publish, so the notice sits on the control that
            does it rather than somewhere the publisher has to go looking. */}
        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
          Publishing grants a permanent license to host and redistribute this package, offers it to
          everyone under CC0, and confirms it&apos;s yours to publish.{" "}
          <Link href="/terms" className="text-foreground underline underline-offset-4">
            Full terms
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
