/**
 * Pure translator: (domains, projects) → the JSON config Caddy's admin API
 * accepts at `/config/apps/http/servers/<serverKey>`. Kept side-effect-free
 * so we can unit-test the output against fixtures without standing up Caddy.
 *
 * Design notes:
 * - One route per *hostname* (not per project). Flat list — at our scale
 *   (thousands of tenants, not millions) this is fine and much simpler to
 *   reason about than shared matchers.
 * - Each route reverse_proxies to the owning project's upstreamUrl and
 *   applies the project's host-header policy (preserve | rewrite_to_upstream).
 * - A catch-all fallback route serves `_error-page` with a synthetic 404
 *   status so unrecognised hostnames see a branded "domain not claimed"
 *   page instead of a blank Caddy response.
 * - TLS is `on_demand` — cert issuance is gated by the ask hook which calls
 *   /_check-hostname in the control plane. We don't express that here; it
 *   lives in the base Caddyfile's global block.
 */

import { Domain } from "../../entities/domain.entity";
import { Project } from "../../entities/project.entity";

export interface CaddyServerConfig {
  listen: string[];
  routes: CaddyRoute[];
  errors?: { routes: CaddyRoute[] };
  automatic_https?: { disable?: boolean };
}

export interface CaddyRoute {
  match?: Array<{ host?: string[]; path?: string[] }>;
  handle: CaddyHandler[];
  terminal?: boolean;
}

export type CaddyHandler =
  | {
      handler: "reverse_proxy";
      upstreams: Array<{ dial: string }>;
      headers?: {
        request?: { set?: Record<string, string[]> };
        response?: { set?: Record<string, string[]> };
      };
      transport?: {
        protocol: "http";
        tls?: { server_name?: string };
        keepalive?: string;
        keepalive_idle_conns?: number;
      };
    }
  | { handler: "rewrite"; uri: string }
  | {
      handler: "static_response";
      status_code: number;
      body?: string;
      headers?: Record<string, string[]>;
    }
  | {
      handler: "rate_limit";
      /** Token-bucket refill rate, requests per second. */
      rate: number;
      /** Max burst size. We set 2× rate so brief spikes don't 429 under normal load. */
      burst: number;
      /** Bucket key — we use `{http.request.host}` so limits apply per-hostname. */
      key: string;
    };

/**
 * Per-domain projection the builder needs. `verified` gates routing: we
 * route unverified hostnames to the control plane's pending-page handler
 * instead of to the upstream, so customers see a "setting up" page rather
 * than a 502 while DNS is still propagating. We include metadata so we can
 * inject it into the upstream request as an X-Hee-Tenant header — the
 * SaaS integrator's upstream reads tenant context without a second DB hit.
 */
type BuilderDomain = Pick<
  Domain,
  "hostname" | "projectId" | "metadata" | "verified"
>;
type BuilderProject = Pick<
  Project,
  | "projectId"
  | "slug"
  | "upstreamUrl"
  | "upstreamHost"
  | "hostHeaderMode"
  | "hostHeaderValue"
  | "rateLimitRps"
  | "enabled"
>;

export interface BuildInput {
  /** Active (non-removed) domains. */
  domains: BuilderDomain[];
  /** Every project referenced by at least one domain. */
  projects: BuilderProject[];
  /** Error-page endpoint the edge rewrites to on 5xx. Defaults to the local control plane. */
  errorPagePath?: string;
  /** Short identifier for this edge node, added as X-Edge-Node response header. */
  edgeNodeId?: string;
}

/**
 * Build the `:443` server config for Caddy. The returned object is the
 * exact JSON shape `POST /config/apps/http/servers/<key>` expects.
 */
export function buildServerConfig(input: BuildInput): CaddyServerConfig {
  const projectsById = new Map(input.projects.map((p) => [p.projectId, p]));
  const errorPagePath = input.errorPagePath ?? "/_error-page";

  const routes: CaddyRoute[] = [];

  // Health probe is first — lets LBs and monitors hit `/_healthz` without
  // tripping TLS handshake overhead for unclaimed hostnames.
  routes.push({
    match: [{ path: ["/_healthz"] }],
    handle: [{ handler: "static_response", status_code: 200, body: "ok" }],
    terminal: true,
  });

  for (const d of input.domains) {
    const project = projectsById.get(d.projectId);
    if (!project || !project.enabled) continue;
    routes.push(
      d.verified
        ? buildHostnameRoute(d, project, input.edgeNodeId)
        : buildPendingRoute(d.hostname),
    );
  }

  // Fallback: hostname wasn't matched by any route above. Rewrite to the
  // error-page handler so the control plane can serve a branded "domain
  // not claimed" response. Caddy will populate the 404 status upstream;
  // we set 404 here to keep behaviour consistent even if the handler 200s.
  routes.push({
    handle: [
      { handler: "rewrite", uri: errorPagePath },
      {
        handler: "reverse_proxy",
        upstreams: [{ dial: "localhost:5301" }],
        headers: {
          request: {
            set: {
              Host: ["api.hee.la"],
              "X-Hee-Original-Host": ["{http.request.host}"],
              "X-Hee-Original-Status": ["404"],
            },
          },
        },
      },
    ],
  });

  return {
    listen: [":443"],
    routes,
    // Stop Caddy from trying to issue certs for the placeholder :443 listen —
    // real cert issuance is driven by on_demand_tls ask hook in the global
    // config, and we don't want Caddy guessing at hostnames from this subtree.
    automatic_https: { disable: true },
  };
}

function buildHostnameRoute(
  d: BuilderDomain,
  project: BuilderProject,
  edgeNodeId?: string,
): CaddyRoute {
  const upstream = parseUpstream(project.upstreamUrl);
  const hostHeader = resolveHostHeader(project, upstream.host);

  // Metadata passthrough. We base64-encode a compact JSON so the header is
  // transport-safe (curly braces and UTF-8 in raw headers is a pit of
  // surprises). SaaS upstreams decode with @heela/sdk's parseHeeTenantHeader.
  const metadataJson = JSON.stringify(d.metadata ?? {});
  const metadataHeader = Buffer.from(metadataJson, "utf8").toString("base64");

  const requestHeaders: Record<string, string[]> = {
    Host: [hostHeader],
    "X-Hee-Tenant": [metadataHeader],
    "X-Hee-Project-Slug": [project.slug],
    "X-Hee-Hostname": [d.hostname],
  };

  const handlers: CaddyHandler[] = [];

  // Rate limit first, so 429s return without consuming upstream capacity.
  // Project-level cap keyed per-hostname means one tenant's traffic spike
  // can't 429 another tenant on the same project.
  if (project.rateLimitRps && project.rateLimitRps > 0) {
    handlers.push({
      handler: "rate_limit",
      rate: project.rateLimitRps,
      burst: Math.max(project.rateLimitRps * 2, 10),
      key: "{http.request.host}",
    });
  }

  handlers.push({
    handler: "reverse_proxy",
    upstreams: [{ dial: `${upstream.host}:${upstream.port}` }],
    headers: {
      request: { set: requestHeaders },
      ...(edgeNodeId
        ? { response: { set: { "X-Edge-Node": [edgeNodeId] } } }
        : {}),
    },
    transport: {
      protocol: "http",
      // TLS SNI must match the upstream's cert, even when Host is the
      // client hostname. This is what lets us preserve the original
      // Host while still terminating upstream TLS correctly.
      tls: upstream.scheme === "https" ? { server_name: upstream.host } : undefined,
      keepalive: "30s",
      keepalive_idle_conns: 32,
    },
  });

  return {
    match: [{ host: [d.hostname] }],
    handle: handlers,
    terminal: true,
  };
}

/**
 * Route that serves the branded "setting up your domain" page for a
 * registered-but-unverified hostname. Rewrites to the control plane's
 * /_pending-page endpoint; the handler inside the control plane looks up
 * the owning project's `pendingPageUrl` (if any) and serves that.
 */
function buildPendingRoute(hostname: string): CaddyRoute {
  return {
    match: [{ host: [hostname] }],
    handle: [
      { handler: "rewrite", uri: "/_pending-page" },
      {
        handler: "reverse_proxy",
        upstreams: [{ dial: "localhost:5301" }],
        headers: {
          request: {
            set: {
              Host: ["api.hee.la"],
              "X-Hee-Original-Host": [hostname],
            },
          },
        },
      },
    ],
    terminal: true,
  };
}

/**
 * Compute the Host header we send to the upstream based on the project's
 * policy. Kept small + explicit so the three modes are obvious to read.
 */
function resolveHostHeader(project: BuilderProject, upstreamHost: string): string {
  const mode = project.hostHeaderMode ?? "preserve";
  if (mode === "static" && project.hostHeaderValue) {
    return project.hostHeaderValue;
  }
  if (mode === "rewrite_to_upstream") {
    return project.upstreamHost ?? upstreamHost;
  }
  // preserve — default. `{http.request.host}` is Caddy's placeholder for the
  // hostname the client hit at the edge.
  return "{http.request.host}";
}

interface ParsedUpstream {
  scheme: "http" | "https";
  host: string;
  port: number;
}

export function parseUpstream(url: string): ParsedUpstream {
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`unsupported upstream scheme: ${u.protocol}`);
  }
  const scheme = u.protocol === "https:" ? "https" : "http";
  const port = u.port
    ? Number(u.port)
    : scheme === "https"
      ? 443
      : 80;
  return { scheme, host: u.hostname, port };
}
