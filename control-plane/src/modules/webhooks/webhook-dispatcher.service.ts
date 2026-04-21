import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHmac } from "node:crypto";
import { Repository } from "typeorm";
import { Project } from "../../entities/project.entity";
import { MetricsService } from "../metrics/metrics.service";
import type { HeeWebhookEvent } from "./webhook.types";

/**
 * Signs + POSTs webhook events to the project's configured `webhookUrl`.
 * Retries with exponential backoff in the background — callers await the
 * first attempt only so request latency isn't tied to a slow receiver.
 *
 * Signature format (X-Hee-Signature header):
 *   t=<unix_seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">
 * Matches Stripe's scheme so receivers can reuse existing verification libs.
 */
@Injectable()
export class WebhookDispatcherService {
  private readonly log = new Logger(WebhookDispatcherService.name);
  private readonly retries = [0, 2_000, 10_000, 60_000, 5 * 60_000];

  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Fire-and-forget. The first attempt is awaited so caller errors surface
   * in logs; subsequent retries happen on a detached timer.
   */
  async dispatch(projectId: string, event: HeeWebhookEvent): Promise<void> {
    const project = await this.projects.findOne({
      where: { projectId },
      select: ["webhookUrl", "webhookSecret", "slug"],
    });
    if (!project?.webhookUrl || !project.webhookSecret) return;

    // Always use the DB's slug so callers can pass a stub — keeps the event
    // contract consistent whether fired from a service that already has the
    // project loaded or one that only has the projectId.
    const enriched = { ...event, projectSlug: project.slug };
    const body = JSON.stringify(enriched);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.sign(project.webhookSecret, timestamp, body);

    // Fire the first attempt eagerly; schedule retries on failure so the
    // caller returns fast.
    this.attempt(project.webhookUrl, body, timestamp, signature, 0, event);
  }

  private attempt(
    url: string,
    body: string,
    timestamp: string,
    signature: string,
    attempt: number,
    event: HeeWebhookEvent,
  ): void {
    const delay = this.retries[attempt];
    if (delay === undefined) {
      this.log.error(`webhook exhausted retries for ${event.event} → ${url}`);
      this.metrics.increment("hee_webhook_deliveries_total", {
        event: event.event,
        result: "exhausted",
      });
      return;
    }

    setTimeout(async () => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Hee-Signature": `t=${timestamp},v1=${signature}`,
            "X-Hee-Event": event.event,
          },
          body,
        });
        if (res.ok) {
          this.log.debug(`webhook ${event.event} → ${url} ${res.status}`);
          this.metrics.increment("hee_webhook_deliveries_total", {
            event: event.event,
            result: "success",
          });
          return;
        }
        // 4xx (except 429) is a terminal error — don't keep retrying on a
        // receiver that can't parse our payload.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          this.log.warn(`webhook ${event.event} → ${url} rejected ${res.status}`);
          this.metrics.increment("hee_webhook_deliveries_total", {
            event: event.event,
            result: "rejected",
          });
          return;
        }
        this.attempt(url, body, timestamp, signature, attempt + 1, event);
      } catch (err) {
        this.log.warn(
          `webhook ${event.event} → ${url} attempt ${attempt} failed: ${(err as Error).message}`,
        );
        this.attempt(url, body, timestamp, signature, attempt + 1, event);
      }
    }, delay);
  }

  private sign(secret: string, timestamp: string, body: string): string {
    return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  }
}
