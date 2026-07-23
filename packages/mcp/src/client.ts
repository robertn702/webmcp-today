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

  lookup(url: string, yolo: boolean): Promise<unknown> {
    const params = new URLSearchParams({ url });
    if (yolo) params.set("yolo", "true");
    return this.request(`/api/configs/lookup?${params}`);
  }

  list(opts: {
    domain?: string;
    page?: number;
    pageSize?: number;
    yolo?: boolean;
  }): Promise<unknown> {
    const params = new URLSearchParams();
    if (opts.domain) params.set("domain", opts.domain);
    if (opts.page) params.set("page", String(opts.page));
    if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
    if (opts.yolo) params.set("yolo", "true");
    return this.request(`/api/configs?${params}`);
  }

  create(config: unknown): Promise<unknown> {
    return this.request("/api/configs", { method: "POST", body: JSON.stringify(config) });
  }

  update(id: string, patch: unknown): Promise<unknown> {
    return this.request(`/api/configs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  vote(id: string, value: 1 | -1): Promise<unknown> {
    return this.request(`/api/configs/${encodeURIComponent(id)}/vote`, {
      method: "POST",
      body: JSON.stringify({ value }),
    });
  }

  stats(): Promise<unknown> {
    return this.request("/api/stats");
  }
}
