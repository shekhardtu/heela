/**
 * Thin server-only client for the Hee control plane. All portal server routes
 * talk to the control plane through this; browsers never call the control
 * plane directly, so session tokens stay in httpOnly cookies.
 *
 * The `HEE_API_URL` env var is set to http://localhost:5301 when the portal
 * runs alongside the control plane on edge-1; otherwise https://api.hee.la.
 */
const HEE_API = (process.env.HEE_API_URL ?? "http://localhost:5301").replace(/\/$/, "");

export interface MeResponse {
  userId: string;
  email: string;
  name: string | null;
  projects: Array<{
    projectId: string;
    slug: string;
    name: string;
    role: "owner" | "member";
  }>;
}

export interface DomainResponse {
  hostname: string;
  projectSlug: string;
  verified: boolean;
  verifiedAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export class HeeApiError extends Error {
  public readonly status: number;
  public readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "HeeApiError";
    this.status = status;
    this.body = body;
  }
}

async function raw(
  method: string,
  path: string,
  opts: { body?: unknown; session?: string; admin?: string; timeoutMs?: number } = {},
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 5000);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.session) headers["Authorization"] = `Bearer ${opts.session}`;
  else if (opts.admin) headers["Authorization"] = `Bearer ${opts.admin}`;
  try {
    return await fetch(`${HEE_API}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: ctrl.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      parsed && typeof parsed === "object" && "message" in parsed
        ? String((parsed as { message?: unknown }).message)
        : `Hee API ${res.status}`;
    throw new HeeApiError(message, res.status, parsed);
  }
  return parsed as T;
}

export const heeApi = {
  auth: {
    async requestMagicLink(email: string): Promise<void> {
      const res = await raw("POST", "/v1/auth/request-magic-link", {
        body: { email },
      });
      if (!res.ok && res.status !== 204) await json(res); // throws if error body
    },
    async callback(token: string): Promise<{
      userId: string;
      email: string;
      sessionToken: string;
      expiresAt: string;
    }> {
      const res = await raw("POST", "/v1/auth/callback", { body: { token } });
      return json(res);
    },
    async me(sessionToken: string): Promise<MeResponse> {
      const res = await raw("GET", "/v1/auth/me", { session: sessionToken });
      return json(res);
    },
    async signOut(sessionToken: string): Promise<void> {
      await raw("POST", "/v1/auth/sign-out", { session: sessionToken });
    },
  },
  domains: {
    async list(projectToken: string): Promise<DomainResponse[]> {
      const res = await raw("GET", "/v1/edge/domains", { session: projectToken });
      return json(res);
    },
  },

  // ── Portal-scoped calls (session cookie) ────────────────────────────────
  portal: {
    async createProject(
      sessionToken: string,
      body: { name: string; slug: string; upstreamUrl: string; upstreamHost?: string },
    ): Promise<PortalProject> {
      const res = await raw("POST", "/v1/portal/projects", { session: sessionToken, body });
      return json(res);
    },
    async getProject(sessionToken: string, slug: string): Promise<PortalProject> {
      const res = await raw("GET", `/v1/portal/projects/${encodeURIComponent(slug)}`, {
        session: sessionToken,
      });
      return json(res);
    },
    async listTokens(sessionToken: string, slug: string): Promise<PortalToken[]> {
      const res = await raw(
        "GET",
        `/v1/portal/projects/${encodeURIComponent(slug)}/tokens`,
        { session: sessionToken },
      );
      return json(res);
    },
    async issueToken(
      sessionToken: string,
      slug: string,
      body: { name: string },
    ): Promise<PortalToken & { token: string }> {
      const res = await raw(
        "POST",
        `/v1/portal/projects/${encodeURIComponent(slug)}/tokens`,
        { session: sessionToken, body },
      );
      return json(res);
    },
    async revokeToken(sessionToken: string, slug: string, tokenId: string): Promise<void> {
      await raw(
        "DELETE",
        `/v1/portal/projects/${encodeURIComponent(slug)}/tokens/${encodeURIComponent(tokenId)}`,
        { session: sessionToken },
      );
    },
    async listDomains(sessionToken: string, slug: string): Promise<PortalDomain[]> {
      const res = await raw(
        "GET",
        `/v1/portal/projects/${encodeURIComponent(slug)}/domains`,
        { session: sessionToken },
      );
      return json(res);
    },
    async registerDomain(
      sessionToken: string,
      slug: string,
      body: { hostname: string; metadata?: Record<string, unknown> },
    ): Promise<PortalDomain> {
      const res = await raw(
        "POST",
        `/v1/portal/projects/${encodeURIComponent(slug)}/domains`,
        { session: sessionToken, body },
      );
      return json(res);
    },
    async removeDomain(
      sessionToken: string,
      slug: string,
      hostname: string,
    ): Promise<void> {
      await raw(
        "DELETE",
        `/v1/portal/projects/${encodeURIComponent(slug)}/domains/${encodeURIComponent(hostname)}`,
        { session: sessionToken },
      );
    },
  },
};

export interface PortalProject {
  projectId: string;
  name: string;
  slug: string;
  upstreamUrl: string;
  upstreamHost: string | null;
  enabled: boolean;
  role: "owner" | "member";
  domainCount: number;
  tokenCount: number;
  createdAt: string;
}

export interface PortalToken {
  tokenId: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface PortalDomain {
  hostname: string;
  verified: boolean;
  verifiedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
