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

/**
 * DNS record the customer must set at their registrar for Hee to terminate
 * TLS and route traffic. SaaS operators should display these verbatim — no
 * vendor-specific knowledge required on the integrator's side.
 */
export interface VerificationRecord {
  type: "CNAME" | "TXT";
  name: string;
  value: string;
}

/**
 * Latest DNS-probe result for a hostname. Feed this directly into your UI:
 * `observedCname` is what we saw; `expectedCname` is what we need; `error`
 * is a short operator-friendly reason ("NXDOMAIN", "wrong target: …").
 */
export interface DomainDiagnosis {
  lastProbeAt: string | null;
  observedCname: string | null;
  expectedCname: string;
  error: string | null;
}

export interface DomainRecord {
  hostname: string;
  projectSlug: string;
  verified: boolean;
  verifiedAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
  /**
   * Records the customer must set in DNS for this hostname. Authoritative —
   * callers should NOT construct these themselves; if Hee changes its edge,
   * this list updates without an SDK release.
   */
  verificationRecords: VerificationRecord[];
  /** Latest DNS-probe result. Populated after the first probe runs. */
  diagnosis: DomainDiagnosis;
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

  /**
   * Force a DNS probe and return the freshly-updated record. Wire this to
   * a "Re-verify" button in your UI so customers don't wait on the 5-min
   * cron; the response includes the latest `diagnosis` fields.
   */
  diagnose(hostname: string): Promise<DomainRecord> {
    return this.client.request<DomainRecord>(
      "POST",
      `/v1/edge/domains/${encodeURIComponent(hostname)}/diagnose`,
    );
  }

  /**
   * Register many hostnames in one call. Idempotent per-row — a hostname
   * already owned by this project updates metadata in place. Rows that
   * conflict with another project's existing claim fail individually;
   * the result array surfaces per-row status so callers can distinguish
   * partial failures without re-trying the whole batch.
   *
   * Expect O(100) hostnames per request; chunk on the caller side for
   * larger migrations.
   */
  registerBulk(
    inputs: RegisterDomainInput[],
  ): Promise<BulkRegisterResult[]> {
    return this.client.request<BulkRegisterResult[]>(
      "POST",
      "/v1/edge/domains/bulk",
      { domains: inputs },
    );
  }
}

// ─── Webhook helpers ─────────────────────────────────────────────────────

/**
 * Canonical webhook event shapes. Mirrors the control plane's webhook.types.ts
 * so integrator handlers can switch on `event.event` with full type safety.
 */
export interface BaseHeeEvent {
  occurredAt: string;
  projectSlug: string;
}

export interface DomainVerifiedEvent extends BaseHeeEvent {
  event: "domain.verified";
  hostname: string;
}

export interface DomainProbeFailedEvent extends BaseHeeEvent {
  event: "domain.probe_failed";
  hostname: string;
  reason: string;
}

export interface CertIssuedEvent extends BaseHeeEvent {
  event: "cert.issued";
  hostname: string;
  expiresAt: string;
}

export interface CertRenewalFailedEvent extends BaseHeeEvent {
  event: "cert.renewal_failed";
  hostname: string;
  reason: string;
  expiresAt: string;
}

export type HeeWebhookEvent =
  | DomainVerifiedEvent
  | DomainProbeFailedEvent
  | CertIssuedEvent
  | CertRenewalFailedEvent;

export interface BulkRegisterResult {
  hostname: string;
  status: "created" | "updated" | "conflict" | "error";
  /** Populated on success (created/updated). Null on conflict/error. */
  record: DomainRecord | null;
  /** Human reason when status === "conflict" | "error". */
  error: string | null;
}

/**
 * Verify a webhook signature. Call this in your receiver before trusting
 * the body. Stripe-style scheme so you can port verification logic from
 * existing libraries: `t=<unix>,v1=<hex-sha256>`.
 *
 *   const ok = verifyHeeSignature({
 *     secret: process.env.HEE_WEBHOOK_SECRET!,
 *     signature: req.headers['x-hee-signature'],
 *     body: rawBody,                   // raw text, NOT parsed JSON
 *     toleranceSeconds: 300,
 *   });
 *
 * Uses the WebCrypto API so it works in Node 18+, Cloudflare Workers,
 * Deno, and Bun without a separate Buffer dependency.
 */
export async function verifyHeeSignature(input: {
  secret: string;
  signature: string | null | undefined;
  body: string;
  toleranceSeconds?: number;
}): Promise<boolean> {
  const { secret, signature, body, toleranceSeconds = 300 } = input;
  if (!signature) return false;

  const parts = Object.fromEntries(
    signature.split(",").map((s) => s.split("=", 2) as [string, string]),
  );
  const timestamp = Number(parts.t);
  const provided = parts.v1;
  if (!Number.isFinite(timestamp) || !provided) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageSeconds > toleranceSeconds) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${body}`),
  );
  const expected = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqualHex(expected, provided);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Read and parse the `X-Hee-Tenant` header that Hee injects on every
 * proxied request. Returns the metadata the SaaS operator attached at
 * registration time (workspaceId, orgId, theme hints, …).
 *
 *   const tenant = parseHeeTenantHeader(req.headers.get('x-hee-tenant'));
 *   const ws = tenant?.workspaceId;
 *
 * Returns null when the header is absent or malformed — callers should
 * fall back to their own routing logic rather than throwing.
 */
export function parseHeeTenantHeader(
  header: string | null | undefined,
): Record<string, unknown> | null {
  if (!header) return null;
  try {
    // Environment-neutral base64 decode: browsers and Workers expose `atob`;
    // Node 16+ also does globally. We fall back to a manual decode only in
    // the unlikely case `atob` is missing (very old runtimes) to keep the
    // SDK zero-dep.
    const decode = (s: string): string => {
      if (typeof atob === "function") {
        const bin = atob(s);
        // Convert latin1 byte string → utf-8 string
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder("utf-8").decode(bytes);
      }
      throw new Error("no base64 decoder available");
    };
    const parsed = JSON.parse(decode(header));
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
