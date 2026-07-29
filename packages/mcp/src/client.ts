// Thin REST client for the webmcp.today registry API.

export interface RegistryClientOptions {
  baseUrl: string;
  apiKey?: string | undefined;
}

export class RegistryClient {
  readonly baseUrl: string;

  constructor(private readonly opts: RegistryClientOptions) {
    this.baseUrl = opts.baseUrl;
  }

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

  lookup(url: string): Promise<unknown> {
    const params = new URLSearchParams({ url });
    return this.request(`/api/packages/lookup?${params}`);
  }

  list(opts: { domain?: string; page?: number; pageSize?: number }): Promise<unknown> {
    const params = new URLSearchParams();
    if (opts.domain) params.set("domain", opts.domain);
    if (opts.page) params.set("page", String(opts.page));
    if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
    return this.request(`/api/packages?${params}`);
  }

  get(id: string): Promise<unknown> {
    return this.request(`/api/packages/${encodeURIComponent(id)}`);
  }

  create(pkg: unknown): Promise<unknown> {
    return this.request("/api/packages", { method: "POST", body: JSON.stringify(pkg) });
  }

  updateMeta(id: string, meta: unknown): Promise<unknown> {
    return this.request(`/api/packages/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(meta),
    });
  }

  publishVersion(id: string, version: unknown): Promise<unknown> {
    return this.request(`/api/packages/${encodeURIComponent(id)}/versions`, {
      method: "POST",
      body: JSON.stringify(version),
    });
  }

  /** Set (create or move) the caller's install pin — also how rollback works. */
  install(id: string, versionId?: string): Promise<unknown> {
    return this.request(`/api/packages/${encodeURIComponent(id)}/install`, {
      method: "PUT",
      body: JSON.stringify(versionId ? { versionId } : {}),
    });
  }

  uninstall(id: string): Promise<unknown> {
    return this.request(`/api/packages/${encodeURIComponent(id)}/install`, { method: "DELETE" });
  }

  installs(): Promise<unknown> {
    return this.request("/api/installs");
  }

  stats(): Promise<unknown> {
    return this.request("/api/stats");
  }
}
