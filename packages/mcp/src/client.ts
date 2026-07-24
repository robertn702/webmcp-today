// Thin REST client for the webmcp.cafe registry API.

export interface CafeClientOptions {
  baseUrl: string;
  apiKey?: string | undefined;
}

export class CafeClient {
  constructor(private readonly opts: CafeClientOptions) {}

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    if (init?.body !== undefined) headers.set("Content-Type", "application/json");
    if (this.opts.apiKey) headers.set("Authorization", `Bearer ${this.opts.apiKey}`);
    const res = await fetch(new URL(path, this.opts.baseUrl), { ...init, headers });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Registry request failed (${res.status}): ${text.slice(0, 500)}`);
    }
    return text ? JSON.parse(text) : null;
  }

  lookup(url: string, installed: boolean): Promise<unknown> {
    const params = new URLSearchParams({ url });
    if (installed) params.set("installed", "true");
    return this.request(`/api/configs/lookup?${params}`);
  }

  list(opts: { domain?: string; page?: number; pageSize?: number }): Promise<unknown> {
    const params = new URLSearchParams();
    if (opts.domain) params.set("domain", opts.domain);
    if (opts.page) params.set("page", String(opts.page));
    if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
    return this.request(`/api/configs?${params}`);
  }

  get(id: string): Promise<unknown> {
    return this.request(`/api/configs/${encodeURIComponent(id)}`);
  }

  create(config: unknown): Promise<unknown> {
    return this.request("/api/configs", { method: "POST", body: JSON.stringify(config) });
  }

  updateMeta(id: string, meta: unknown): Promise<unknown> {
    return this.request(`/api/configs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(meta),
    });
  }

  publishVersion(id: string, version: unknown): Promise<unknown> {
    return this.request(`/api/configs/${encodeURIComponent(id)}/versions`, {
      method: "POST",
      body: JSON.stringify(version),
    });
  }

  install(id: string, versionId?: string): Promise<unknown> {
    return this.request(`/api/configs/${encodeURIComponent(id)}/install`, {
      method: "POST",
      body: JSON.stringify(versionId ? { versionId } : {}),
    });
  }

  uninstall(id: string): Promise<unknown> {
    return this.request(`/api/configs/${encodeURIComponent(id)}/install`, { method: "DELETE" });
  }

  updateInstall(id: string, versionId?: string): Promise<unknown> {
    return this.request(`/api/configs/${encodeURIComponent(id)}/update`, {
      method: "POST",
      body: JSON.stringify(versionId ? { versionId } : {}),
    });
  }

  stats(): Promise<unknown> {
    return this.request("/api/stats");
  }
}
