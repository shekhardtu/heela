/**
 * @heela/sdk — thin, zero-dependency client for the Hee edge control plane.
 *
 * Each project (Colbin, YoFix, Kundali, ...) calls this from its own backend
 * to register / remove / list the customer-owned hostnames routed through the
 * Hee edge. One service token per project, scoped at the control plane.
 *
 *   import { HeeClient } from "@heela/sdk";
 *   const hee = new HeeClient({ token: process.env.HEE_API_TOKEN! });
 *   await hee.domains.register({ hostname: "engineering.loopai.com", metadata: { workspaceSlug: "engineering" } });
 */

export interface HeeClientOptions {
  /** API token issued by the control plane. Starts with `hee_`. */
  token: string;
  /** Control-plane base URL. Defaults to https://api.hee.la. */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 5000. */
  timeoutMs?: number;
  /** Custom fetch implementation (testing, polyfill). Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
}

export interface DomainRecord {
  hostname: string;
  projectSlug: string;
  verified: boolean;
  verifiedAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface RegisterDomainInput {
  hostname: string;
  metadata?: Record<string, unknown>;
}

export class HeeError extends Error {
  public readonly status: number;
  public readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "HeeError";
    this.status = status;
    this.body = body;
  }
}

export class HeeClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  public readonly domains: DomainsApi;

  constructor(options: HeeClientOptions) {
    if (!options.token) throw new Error("HeeClient: token is required");
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? "https://api.hee.la").replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.domains = new DomainsApi(this);
  }

  /** @internal */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (res.status === 204) return undefined as T;

      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        /* empty response */
      }

      if (!res.ok) {
        const message =
          parsed && typeof parsed === "object" && "message" in parsed
            ? String((parsed as { message?: unknown }).message)
            : `Hee request failed: ${res.status}`;
        throw new HeeError(message, res.status, parsed);
      }

      return parsed as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

class DomainsApi {
  constructor(private readonly client: HeeClient) {}

  /** Register a customer-owned hostname. Idempotent. */
  register(input: RegisterDomainInput): Promise<DomainRecord> {
    return this.client.request<DomainRecord>("POST", "/v1/edge/domains", input);
  }

  /** List all domains owned by this token's project. */
  list(): Promise<DomainRecord[]> {
    return this.client.request<DomainRecord[]>("GET", "/v1/edge/domains");
  }

  /** Soft-delete a hostname. Cert + config retained briefly for re-add. */
  remove(hostname: string): Promise<void> {
    return this.client.request<void>(
      "DELETE",
      `/v1/edge/domains/${encodeURIComponent(hostname)}`,
    );
  }
}
