import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "node:crypto";
import { IsNull, Repository } from "typeorm";
import { Domain } from "../../entities/domain.entity";
import { Project } from "../../entities/project.entity";
import { CaddyReconcilerService } from "../caddy/caddy-reconciler.service";
import { MetricsService } from "../metrics/metrics.service";
import {
  BulkRegisterDomainDto,
  BulkRegisterResult,
  DomainDiagnosis,
  DomainResponse,
  RegisterDomainDto,
  VerificationRecord,
} from "./domain.dto";
import { DomainVerifyService } from "./verify.service";

/** Default hostname the customer must CNAME to when the env var isn't set. */
const DEFAULT_CNAME_TARGET = "edge.hee.la";

@Injectable()
export class DomainsService {
  private readonly cnameTarget: string;

  constructor(
    @InjectRepository(Domain)
    private readonly domains: Repository<Domain>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    private readonly config: ConfigService,
    private readonly verifier: DomainVerifyService,
    private readonly caddy: CaddyReconcilerService,
    private readonly metrics: MetricsService,
  ) {
    this.cnameTarget =
      this.config.get<string>("HEE_CNAME_TARGET") ?? DEFAULT_CNAME_TARGET;
  }

  /**
   * Run a DNS probe on demand for a hostname owned by this project and
   * return the latest row (with diagnosis populated). Lets SaaS callers
   * trigger a "Re-verify" button without waiting for the 5-min cron.
   */
  async diagnose(projectId: string, hostname: string): Promise<DomainResponse> {
    const row = await this.domains.findOne({
      where: {
        hostname: hostname.toLowerCase(),
        projectId,
        removedAt: IsNull(),
      },
      relations: ["project"],
    });
    if (!row) throw new NotFoundException("domain not found");
    const refreshed = await this.verifier.probeOne(row);
    // verifier.probeOne returns the merged row shape but not the project relation.
    refreshed.project = row.project;
    return this.toResponse(refreshed);
  }

  async register(
    projectId: string,
    dto: RegisterDomainDto,
  ): Promise<DomainResponse> {
    const hostname = dto.hostname.toLowerCase();

    // Cross-tenant uniqueness — one hostname, one owner, forever.
    const existing = await this.domains.findOne({
      where: { hostname, removedAt: IsNull() },
    });
    if (existing && existing.projectId !== projectId) {
      throw new ConflictException("hostname is already claimed");
    }
    if (existing) {
      // Same project re-registering — idempotent. Update metadata if provided.
      if (dto.metadata) {
        existing.metadata = dto.metadata;
        await this.domains.save(existing);
      }
      return this.toResponse(existing);
    }

    const project = await this.projects.findOne({ where: { projectId } });
    if (!project) throw new NotFoundException("project not found");

    // Generate a TXT challenge up-front if the project requires ownership
    // pre-check. `hee_<32 hex chars>` is easy to spot in DNS tooling and
    // long enough to be unguessable.
    const txtChallenge = project.requireTxtVerification
      ? `hee_${randomBytes(16).toString("hex")}`
      : null;

    const row = this.domains.create({
      hostname,
      projectId,
      metadata: dto.metadata ?? {},
      txtChallenge,
    });
    const saved = await this.domains.save(row);
    saved.project = project;
    this.metrics.increment("hee_domain_mutations_total", { action: "register" });
    // Best-effort — if Caddy admin is briefly down the cron-free boot
    // reconcile catches up on next control-plane restart. We don't block
    // the API response on edge sync.
    this.caddy.reconcile().catch(() => undefined);
    // Probe DNS immediately. Customers usually set the CNAME *before*
    // claiming the domain in the SaaS UI, so in the common case this one
    // lookup flips verified=true in under a second and avoids a 0-5 min
    // wait for the next cron tick. probeOne persists the diagnosis and
    // (if verified) fires the Caddy route promotion — so the first HTTPS
    // request to the hostname goes straight to cert issuance instead of
    // the pending-page.
    let response: DomainResponse;
    try {
      const probed = await this.verifier.probeOne(saved);
      probed.project = project;
      response = this.toResponse(probed);
    } catch {
      // Probe errors (DNS timeouts, etc.) are non-fatal — the cron will
      // retry. Caller still gets a successful register response.
      response = this.toResponse(saved);
    }
    return response;
  }

  /**
   * Register a batch of hostnames in one call. Each row is processed
   * independently — one bad row doesn't fail the rest. Returns a parallel
   * array so callers can correlate input to outcome by hostname.
   */
  async registerBulk(
    projectId: string,
    dto: BulkRegisterDomainDto,
  ): Promise<BulkRegisterResult[]> {
    const out: BulkRegisterResult[] = [];
    for (const item of dto.domains) {
      const hostname = item.hostname.toLowerCase();
      try {
        const existing = await this.domains.findOne({
          where: { hostname, removedAt: IsNull() },
        });
        const updating = !!existing && existing.projectId === projectId;
        const record = await this.register(projectId, item);
        out.push({
          hostname,
          status: updating ? "updated" : "created",
          record,
          error: null,
        });
      } catch (err) {
        const status =
          err instanceof ConflictException ? "conflict" : "error";
        out.push({
          hostname,
          status,
          record: null,
          error: (err as Error).message,
        });
      }
    }
    // register() triggers reconciles as it goes, but coalesce a final one
    // in case any row short-circuited early.
    this.caddy.reconcile().catch(() => undefined);
    return out;
  }

  async list(projectId: string): Promise<DomainResponse[]> {
    const rows = await this.domains.find({
      where: { projectId, removedAt: IsNull() },
      relations: ["project"],
      order: { createdAt: "DESC" },
    });
    return rows.map((d) => this.toResponse(d));
  }

  async remove(projectId: string, hostname: string): Promise<void> {
    const row = await this.domains.findOne({
      where: {
        hostname: hostname.toLowerCase(),
        projectId,
        removedAt: IsNull(),
      },
    });
    if (!row) throw new NotFoundException("domain not found");
    // Soft delete — keeps cert & serves stale briefly if the customer re-adds.
    await this.domains.update(row.domainId, { removedAt: new Date() });
    this.metrics.increment("hee_domain_mutations_total", { action: "remove" });
    this.caddy.reconcile().catch(() => undefined);
  }

  /**
   * Lookup used by Caddy via /_check-hostname (public, unauth) AND by
   * /v1/edge/resolve. Returns the row + owning project, or null.
   */
  async lookup(
    hostname: string,
  ): Promise<{ domain: Domain; project: Project } | null> {
    const row = await this.domains.findOne({
      where: { hostname: hostname.toLowerCase(), removedAt: IsNull() },
      relations: ["project"],
    });
    if (!row || !row.project || !row.project.enabled) return null;
    return { domain: row, project: row.project };
  }

  private toResponse(d: Domain): DomainResponse {
    return {
      hostname: d.hostname,
      projectSlug: d.project?.slug ?? "",
      verified: d.verified,
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      metadata: d.metadata,
      verificationRecords: this.buildVerificationRecords(d),
      diagnosis: this.buildDiagnosis(d),
      cert: {
        issuedAt: d.certIssuedAt?.toISOString() ?? null,
        expiresAt: d.certExpiresAt?.toISOString() ?? null,
        lastCheckedAt: d.certLastCheckedAt?.toISOString() ?? null,
      },
    };
  }

  /**
   * Records the customer must set in DNS. CNAME is always required; the
   * TXT record is added only when the project requires pre-verification
   * (anti-hijack). Built per-request so config changes land immediately
   * for `list` callers without a migration.
   */
  private buildVerificationRecords(d: Domain): VerificationRecord[] {
    const records: VerificationRecord[] = [
      { type: "CNAME", name: d.hostname, value: this.cnameTarget },
    ];
    if (d.txtChallenge) {
      records.push({
        type: "TXT",
        name: `_hee-verify.${d.hostname}`,
        value: d.txtChallenge,
      });
    }
    return records;
  }

  private buildDiagnosis(d: Domain): DomainDiagnosis {
    return {
      lastProbeAt: d.lastProbeAt?.toISOString() ?? null,
      observedCname: d.lastObservedCname ?? null,
      expectedCname: this.cnameTarget,
      error: d.lastProbeError ?? null,
    };
  }
}
