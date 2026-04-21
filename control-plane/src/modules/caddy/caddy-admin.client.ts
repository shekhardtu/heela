import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Thin client for Caddy's Admin API (https://caddyserver.com/docs/api).
 * We only need PUT to replace a server's config atomically — Caddy handles
 * the hot-reload without dropping connections.
 *
 * Admin API is bound to localhost:2019 on every Hee edge node. On a single-
 * box deploy this client runs in-process next to Caddy; on multi-region
 * (Phase 3) the reconciler will fan out to every edge's admin endpoint.
 */
@Injectable()
export class CaddyAdminClient {
  private readonly log = new Logger(CaddyAdminClient.name);
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>("CADDY_ADMIN_URL") ?? "http://localhost:2019";
    this.fetchImpl = globalThis.fetch;
  }

  /**
   * Caddy's admin API requires an `Origin` header matching the configured
   * allow-list when bound to a non-loopback address. Node's built-in fetch
   * doesn't set one, so we always send our own — matching the baseUrl so
   * the admin block's `origins` directive can be kept tight.
   */
  private adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Origin: this.baseUrl,
      ...extra,
    };
  }

  /**
   * Read config at a given path. Returns null if Caddy has nothing there
   * (fresh server, path not populated yet). Throws on other errors.
   */
  async getConfig<T>(path: string): Promise<T | null> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchImpl(url, { headers: this.adminHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => "<no body>");
      this.log.error(`caddy admin GET ${path} → ${res.status}: ${text}`);
      throw new Error(`caddy admin GET rejected at ${path}: ${res.status}`);
    }
    const text = await res.text();
    if (!text || text === "null") return null;
    return JSON.parse(text) as T;
  }

  /**
   * Replace the config at a given path atomically. Caddy validates + hot-
   * reloads in one step; failure returns 400 with the validation error so
   * we can surface it to the operator.
   */
  async putConfig(path: string, body: unknown): Promise<void> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: this.adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "<no body>");
      this.log.error(`caddy admin ${path} → ${res.status}: ${text}`);
      throw new Error(`caddy admin rejected config at ${path}: ${res.status}`);
    }
    this.log.debug(`caddy admin ${path} → ${res.status}`);
  }

  /** Health-check the admin API. Used by the reconciler to bail early. */
  async ping(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/config/`, {
        headers: this.adminHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
