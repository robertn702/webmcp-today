"use client";

import { ApiKeys } from "@/components/api-keys";
import { authClient } from "@/lib/auth-client";

export default function SettingsPage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <p className="text-sm text-stone-500">Loading…</p>;

  if (!session) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold">Settings</h1>
        <p className="mb-4 text-sm text-stone-600">
          Sign in to submit configs from the browser and manage agent API keys.
        </p>
        <button
          onClick={() => void authClient.signIn.social({ provider: "github" })}
          className="rounded bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700"
        >
          Sign in with GitHub
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Settings</h1>
      <div className="mb-6 flex items-center gap-3 text-sm">
        <span>
          Signed in as <strong>{session.user.name}</strong>
        </span>
        <button
          onClick={() => void authClient.signOut()}
          className="rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100"
        >
          Sign out
        </button>
      </div>
      <ApiKeys />
    </div>
  );
}
