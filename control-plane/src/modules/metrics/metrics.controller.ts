import { Controller, Get, OnModuleInit, Res } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { FastifyReply } from "fastify";
import { MetricsService } from "./metrics.service";

/**
 * Public, unauthenticated Prometheus scrape endpoint. Sits outside the
 * throttler because scrapers hit it every 15s.
 *
 * Only counter metrics today — cheap and small. Histograms come with the
 * cert-issuance latency work (Phase 4+ deferred custom Caddy module).
 */
@SkipThrottle()
@Controller()
export class MetricsController implements OnModuleInit {
  constructor(private readonly metrics: MetricsService) {}

  onModuleInit(): void {
    // Register help lines once; the values themselves accrue via increment().
    this.metrics.describe(
      "hee_domain_verification_attempts_total",
      "DNS probes run by the verify service, labelled by outcome.",
    );
    this.metrics.describe(
      "hee_domain_mutations_total",
      "Domain register/remove/diagnose operations, labelled by action.",
    );
    this.metrics.describe(
      "hee_webhook_deliveries_total",
      "Webhook delivery attempts, labelled by event and outcome.",
    );
    this.metrics.describe(
      "hee_caddy_reconciles_total",
      "Caddy admin-API reconciles issued by the control plane.",
    );
  }

  @Get("metrics")
  async metricsEndpoint(
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    res.status(200);
    res.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.header("Cache-Control", "no-store");
    res.send(this.metrics.render());
  }
}
