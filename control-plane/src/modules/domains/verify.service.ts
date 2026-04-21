import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { promises as dns } from "node:dns";
import { IsNull, Repository } from "typeorm";
import { Domain } from "../../entities/domain.entity";
import { CaddyReconcilerService } from "../caddy/caddy-reconciler.service";
import { MetricsService } from "../metrics/metrics.service";
import { WebhookDispatcherService } from "../webhooks/webhook-dispatcher.service";

const DEFAULT_CNAME_TARGET = "edge.hee.la";

/**
 * Periodically probes customer DNS and records the result against each
 * pending domain. Responsibilities:
 *
 * 1. Flip `verified=true` once the CNAME resolves to the configured edge
 *    target. One-way — a verified domain never un-verifies on a transient
 *    DNS outage. Cert renewal fails on its own if the customer really
 *    removed the record.
 * 2. Record diagnosis (`lastProbeAt`, `lastObservedCname`, `lastProbeError`)
 *    on every tick, verified or not. This is what powers "detected vs
 *    expected" UX on the SaaS caller's side — they don't need to run their
 *    own DNS probe.
 */
@Injectable()
export class DomainVerifyService {
  private readonly log = new Logger(DomainVerifyService.name);
  private readonly cnameTarget: string;

  constructor(
    @InjectRepository(Domain)
    private readonly domains: Repository<Domain>,
    private readonly config: ConfigService,
    private readonly webhooks: WebhookDispatcherService,
    private readonly caddy: CaddyReconcilerService,
    private readonly metrics: MetricsService,
  ) {
    this.cnameTarget =
      this.config.get<string>("HEE_CNAME_TARGET") ?? DEFAULT_CNAME_TARGET;
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: "verify-domains" })
  async tick(): Promise<void> {
    const pending = await this.domains.find({
      where: { verified: false, removedAt: IsNull() },
    });
    if (pending.length === 0) return;

    this.log.log(`probing ${pending.length} unverified domain(s)`);
    for (const row of pending) {
      await this.probeOne(row);
    }
  }

  /**
   * Public entry point so callers (e.g. a /verify endpoint) can force a
   * probe on demand instead of waiting for the cron tick. Runs a single
   * DNS lookup and persists the diagnosis.
   */
  async probeOne(row: Domain): Promise<Domain> {
    const probeAt = new Date();
    let observed: string | null = null;
    let error: string | null = null;
    let cnameOk = false;

    try {
      const targets = await dns.resolveCname(row.hostname);
      observed = targets[0]?.replace(/\.$/, "").toLowerCase() ?? null;
      cnameOk = targets.some(
        (t) => t.replace(/\.$/, "").toLowerCase() === this.cnameTarget,
      );
      if (!cnameOk && observed) {
        error = `wrong target: points at ${observed}`;
      } else if (!cnameOk) {
        error = "no CNAME records returned";
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? "";
      // Normalise Node's DNS error codes into a short, operator-friendly reason.
      if (code === "ENOTFOUND" || code === "ENODATA") {
        error = code === "ENOTFOUND" ? "NXDOMAIN" : "no CNAME record set";
      } else {
        error = (err as Error).message ?? "probe failed";
      }
      this.log.debug(`probe ${row.hostname} failed: ${error}`);
    }

    // Anti-hijack: if the project required TXT pre-verification, the CNAME
    // alone isn't enough — we also need to see the challenge token at
    // `_hee-verify.<hostname>`. If CNAME failed we short-circuit; no point
    // querying TXT when the primary check already failed.
    let txtOk = true;
    if (cnameOk && row.txtChallenge) {
      try {
        const txtRecords = await dns.resolveTxt(`_hee-verify.${row.hostname}`);
        // resolveTxt returns string[][] (each record is an array of strings
        // that the zone may have split). Join each record before matching.
        txtOk = txtRecords.some(
          (chunks) => chunks.join("") === row.txtChallenge,
        );
        if (!txtOk) {
          error = "TXT verification token not found at _hee-verify record";
        }
      } catch (err) {
        txtOk = false;
        error = "TXT verification record missing";
        this.log.debug(`TXT probe ${row.hostname} failed: ${(err as Error).message}`);
      }
    }

    const matched = cnameOk && txtOk;

    const update: {
      lastProbeAt: Date;
      lastObservedCname: string | null;
      lastProbeError: string | null;
      verified?: boolean;
      verifiedAt?: Date;
      txtChallenge?: string | null;
    } = {
      lastProbeAt: probeAt,
      lastObservedCname: observed,
      lastProbeError: matched ? null : error,
    };
    const firstVerify = matched && !row.verified;
    if (firstVerify) {
      update.verified = true;
      update.verifiedAt = probeAt;
      // Challenge served its purpose; clear it so the TXT record can be
      // removed from DNS without un-verifying the domain.
      update.txtChallenge = null;
      this.log.log(`verified ${row.hostname}`);
    }
    const firstProbeFailure =
      !matched && !row.verified && !row.lastProbeError && error;

    await this.domains.update(row.domainId, update);

    this.metrics.increment("hee_domain_verification_attempts_total", {
      result: matched ? "success" : "failure",
    });

    // Fire webhooks after the DB commit so receivers see state consistent
    // with what /v1/edge/domains would return. Fire-and-forget — retries
    // run in the dispatcher.
    if (firstVerify) {
      // Now that the row is verified, swap its Caddy route from the
      // pending-page handler to a real reverse_proxy — unverified hostnames
      // render the branded "setting up" page until this flip.
      this.caddy.reconcile().catch(() => undefined);
      this.webhooks
        .dispatch(row.projectId, {
          event: "domain.verified",
          occurredAt: probeAt.toISOString(),
          projectSlug: "",
          hostname: row.hostname,
        })
        .catch(() => undefined);
    } else if (firstProbeFailure) {
      this.webhooks
        .dispatch(row.projectId, {
          event: "domain.probe_failed",
          occurredAt: probeAt.toISOString(),
          projectSlug: "",
          hostname: row.hostname,
          reason: error ?? "probe failed",
        })
        .catch(() => undefined);
    }

    return { ...row, ...update } as Domain;
  }
}
