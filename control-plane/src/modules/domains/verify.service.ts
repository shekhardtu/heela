import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { promises as dns } from "node:dns";
import { IsNull, Repository } from "typeorm";
import { Domain } from "../../entities/domain.entity";

const CNAME_TARGET = "edge.hee.la";

/**
 * Periodically probes customer DNS to flip `domains.verified` when the
 * CNAME resolves to edge.hee.la. One-way by design — we never un-verify
 * a domain that was previously verified, because transient DNS outages
 * shouldn't drop a production badge. If a customer really removed the
 * CNAME, cert renewal will fail on its own.
 */
@Injectable()
export class DomainVerifyService {
  private readonly log = new Logger(DomainVerifyService.name);

  constructor(
    @InjectRepository(Domain)
    private readonly domains: Repository<Domain>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: "verify-domains" })
  async tick(): Promise<void> {
    const pending = await this.domains.find({
      where: { verified: false, removedAt: IsNull() },
    });
    if (pending.length === 0) return;

    this.log.log(`probing ${pending.length} unverified domain(s)`);
    for (const row of pending) {
      try {
        const targets = await dns.resolveCname(row.hostname);
        const ok = targets.some(
          (t) => t.replace(/\.$/, "").toLowerCase() === CNAME_TARGET,
        );
        if (ok) {
          await this.domains.update(row.domainId, {
            verified: true,
            verifiedAt: new Date(),
          });
          this.log.log(`verified ${row.hostname}`);
        }
      } catch (err) {
        // NXDOMAIN, ENODATA, timeout — customer hasn't pointed DNS yet, or
        // their CNAME is flat/flattened. Log at debug, not warn, so healthy
        // pending domains don't fill the logs during the typical wait window.
        this.log.debug(`probe ${row.hostname} failed: ${(err as Error).message}`);
      }
    }
  }
}
