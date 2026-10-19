/**
 * Minimal SharePoint REST client that runs in the browser on a SharePoint page,
 * using the signed-in user's own session (no app registration, no tokens).
 */
export class SpError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message);
  }
}

export class SharePoint {
  private digest = "";
  private digestExpires = 0;

  constructor(public webUrl: string) {}

  private async getDigest() {
    if (this.digest && Date.now() < this.digestExpires) return this.digest;
    const res = await fetch(`${this.webUrl}/_api/contextinfo`, {
      method: "POST",
      headers: { Accept: "application/json;odata=verbose" },
      credentials: "include",
    });
    if (!res.ok) throw new SpError(`Couldn't get a request digest (HTTP ${res.status}). Are you signed in to this site?`, res.status, await res.text());
    const json = await res.json();
    const info = json.d.GetContextWebInformation;
    this.digest = info.FormDigestValue;
    this.digestExpires = Date.now() + (info.FormDigestTimeoutSeconds - 60) * 1000;
    return this.digest;
  }

  /** Low-level request with throttling retries (429/503 honour Retry-After). */
  async request<T = any>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.webUrl}/_api/${path}`;
    for (let attempt = 0; ; attempt++) {
      const headers: Record<string, string> = { Accept: "application/json;odata=verbose", ...extraHeaders };
      if (method !== "GET") {
        headers["X-RequestDigest"] = await this.getDigest();
        if (body !== undefined) headers["Content-Type"] = "application/json;odata=verbose";
      }
      const res = await fetch(url, {
        method: method === "MERGE" ? "POST" : method,
        headers: method === "MERGE" ? { ...headers, "X-HTTP-Method": "MERGE", "IF-MATCH": "*" } : headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
      });
      if ((res.status === 429 || res.status === 503) && attempt < 6) {
        const wait = Number(res.headers.get("Retry-After") ?? 0) * 1000 || 1000 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, Math.min(wait, 30_000)));
        continue;
      }
      const text = await res.text();
      if (!res.ok) {
        let message = text;
        try {
          message = JSON.parse(text).error.message.value;
        } catch {
          /* keep raw text */
        }
        throw new SpError(`${method} ${path} → ${res.status}: ${message}`, res.status, text);
      }
      if (!text) return undefined as T;
      const json = JSON.parse(text);
      return (json.d ?? json) as T;
    }
  }

  get = <T = any>(path: string) => this.request<T>("GET", path);
  post = <T = any>(path: string, body?: unknown) => this.request<T>("POST", path, body);
  merge = (path: string, body: unknown) => this.request("MERGE", path, body);

  /** GET that returns null on 404 instead of throwing. */
  async tryGet<T = any>(path: string): Promise<T | null> {
    try {
      return await this.get<T>(path);
    } catch (e) {
      if (e instanceof SpError && e.status === 404) return null;
      throw e;
    }
  }

  /** All items of a list (follows paging). */
  async allItems<T = any>(listId: string, select: string): Promise<T[]> {
    const out: T[] = [];
    let next: string | null = `web/lists(guid'${listId}')/items?$select=${select}&$top=5000`;
    while (next) {
      const page: { results: T[]; __next?: string } = await this.get(next);
      out.push(...page.results);
      next = page.__next ?? null;
    }
    return out;
  }
}

/** Find the current site's URL from the SharePoint page we're running on. */
export function detectWebUrl(): string {
  const ctx = (globalThis as { _spPageContextInfo?: { webAbsoluteUrl?: string } })._spPageContextInfo;
  if (ctx?.webAbsoluteUrl) return ctx.webAbsoluteUrl.replace(/\/$/, "");
  const m = location.pathname.match(/^\/(sites|teams)\/[^/]+/i);
  return `${location.origin}${m ? m[0] : ""}`;
}
