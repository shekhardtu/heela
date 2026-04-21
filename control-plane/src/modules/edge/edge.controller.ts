import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Query,
  Res,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { FastifyReply } from "fastify";
import { DomainsService } from "../domains/domains.service";
import { ErrorPageService } from "../domains/error-page.service";

/**
 * Public, unauthenticated endpoints hit by Caddy directly from every edge PoP:
 *
 *   GET /_check-hostname?domain=X  — on_demand_tls ask hook. 2xx → issue cert.
 *   GET /v1/edge/resolve?hostname=X — returns upstream URL + project metadata.
 *
 * The resolve endpoint is the one Caddy will call per-request once we switch
 * to dynamic upstreams (Task #8). For now it's only exercised by tests.
 *
 * Throttling is disabled on this controller — Caddy hits these from its own
 * IP on every TLS handshake / resolve, so a per-IP rate limit would kneecap
 * legitimate traffic. Abuse protection for these lives at Caddy (IP allowlist
 * via systemd/nftables if needed) and at the cheap indexed Postgres lookup.
 */
@SkipThrottle()
@Controller()
export class EdgeController {
  constructor(
    private readonly domains: DomainsService,
    private readonly errorPages: ErrorPageService,
  ) {}

  @Get("_check-hostname")
  async checkHostname(
    @Query("domain") domain: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<{ domain: string; allowed: boolean }> {
    if (!domain) {
      res.status(HttpStatus.BAD_REQUEST);
      return { domain: "", allowed: false };
    }
    const hit = await this.domains.lookup(domain);
    if (!hit) {
      res.status(HttpStatus.NOT_FOUND);
      return { domain, allowed: false };
    }
    return { domain, allowed: true };
  }

  @Get("v1/edge/resolve")
  async resolve(
    @Query("hostname") hostname: string,
  ): Promise<{
    hostname: string;
    projectSlug: string;
    upstream: string;
    upstreamHost: string | null;
    metadata: Record<string, unknown>;
  }> {
    if (!hostname) throw new NotFoundException("hostname required");
    const hit = await this.domains.lookup(hostname);
    if (!hit) throw new NotFoundException("hostname not registered");
    return {
      hostname: hit.domain.hostname,
      projectSlug: hit.project.slug,
      upstream: hit.project.upstreamUrl,
      upstreamHost: hit.project.upstreamHost,
      metadata: hit.domain.metadata,
    };
  }

  @Get("healthz")
  @HttpCode(200)
  health(): { status: string } {
    return { status: "ok" };
  }

  /**
   * Rendered by Caddy's handle_errors when a customer domain's upstream 5xxs.
   * Looks up the owning project's errorPageUrl, fetches it (1-min cache), and
   * serves the HTML back. Falls through to a minimal default if unset.
   *
   * Expected headers (Caddy sets these):
   *   X-Hee-Original-Host   — the customer hostname
   *   X-Hee-Original-Status — upstream status (5xx)
   */
  @Get("_error-page")
  async errorPage(
    @Headers("x-hee-original-host") host: string | undefined,
    @Headers("x-hee-original-status") status: string | undefined,
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    const statusCode = Number(status) || 502;
    const html = await this.errorPages.renderFor(host ?? "", statusCode);
    res.status(statusCode);
    res.header("Content-Type", "text/html; charset=utf-8");
    res.header("Cache-Control", "no-store");
    res.send(html);
  }

  /**
   * Served by the edge while a hostname is registered but `verified=false`
   * (customer hasn't finished DNS yet). Uses the project's configured
   * `pendingPageUrl` when set, otherwise a branded fallback. Responds 202
   * so CDNs and crawlers treat the response as transient rather than a
   * cacheable 200.
   */
  @Get("_pending-page")
  async pendingPage(
    @Headers("x-hee-original-host") host: string | undefined,
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    const html = await this.errorPages.renderPendingFor(host ?? "");
    res.status(202);
    res.header("Content-Type", "text/html; charset=utf-8");
    res.header("Cache-Control", "no-store");
    res.send(html);
  }
}
