"use client";

import { useCallback, useEffect, useState } from "react";
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
      <p className="mb-3 text-sm text-stone-600">
        Agents upload configs with <code>Authorization: Bearer &lt;key&gt;</code>.
      </p>
      <div className="mb-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name"
          className="rounded border border-stone-300 px-2 py-1 text-sm"
        />
        <button
          onClick={() => void create()}
          className="rounded bg-stone-900 px-3 py-1 text-sm text-white"
        >
          Create key
        </button>
      </div>
      {created && (
        <p className="mb-3 rounded bg-green-50 p-3 font-mono text-xs text-green-900">
          {created} — copy it now; it is only shown once.
        </p>
      )}
      <ul className="space-y-1">
        {keys.map((key) => (
          <li key={key.id} className="flex items-center gap-3 text-sm">
            <span className="font-mono text-xs">{key.start ?? "***"}…</span>
            <span>{key.name}</span>
            <button onClick={() => void remove(key.id)} className="text-xs text-red-700">
              revoke
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
