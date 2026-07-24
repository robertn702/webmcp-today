"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

type KeyRow = { id: string; name?: string | null; start?: string | null };

export function ApiKeys() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await authClient.apiKey.list();
    if (data) setKeys(data.apiKeys);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create() {
    const { data } = await authClient.apiKey.create({ name: name || "agent-key" });
    if (data) {
      setCreated(data.key);
      setName("");
      void refresh();
    }
  }

  async function remove(keyId: string) {
    await authClient.apiKey.delete({ keyId });
    void refresh();
  }

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Agent API keys</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Agents upload configs with <code>Authorization: Bearer &lt;key&gt;</code>.
      </p>
      <div className="mb-3 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name"
          className="max-w-48"
        />
        <Button onClick={() => void create()}>Create key</Button>
      </div>
      {created && (
        <Alert variant="success" className="mb-3">
          <AlertTitle>Your new API key</AlertTitle>
          <AlertDescription className="font-mono text-xs">
            {created} — copy it now; it is only shown once.
          </AlertDescription>
        </Alert>
      )}
      <ul className="flex flex-col gap-1">
        {keys.map((key) => (
          <li key={key.id} className="flex items-center gap-3 text-sm">
            <span className="font-mono text-xs">{key.start ?? "***"}…</span>
            <span>{key.name}</span>
            <Button
              variant="link"
              size="sm"
              onClick={() => void remove(key.id)}
              className="text-destructive"
            >
              revoke
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
