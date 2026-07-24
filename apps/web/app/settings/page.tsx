"use client";

import { ApiKeys } from "@/components/api-keys";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function SettingsPage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!session) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold">Settings</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Sign in to submit configs from the browser and manage agent API keys.
        </p>
        <Button onClick={() => void authClient.signIn.social({ provider: "github" })}>
          Sign in with GitHub
        </Button>
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
        <Button variant="outline" size="sm" onClick={() => void authClient.signOut()}>
          Sign out
        </Button>
      </div>
      <ApiKeys />
    </div>
  );
}
