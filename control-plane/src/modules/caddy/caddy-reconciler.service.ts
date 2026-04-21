import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { Domain } from "../../entities/domain.entity";
import { Project } from "../../entities/project.entity";
import { MetricsService } from "../metrics/metrics.service";
import { CaddyAdminClient } from "./caddy-admin.client";
import { buildServerConfig } from "./caddy-config.builder";

/**
 * Keeps Caddy's per-hostname route table in sync with the domains + projects
 * tables in Postgres.
 *
 * Called by:
 *   - OnApplicationBootstrap — ensures drift-free state after a control-
 *     plane restart even if Caddy's persisted config survived.
 *   - DomainsService.register/remove — after every CRUD write.
 *   - ProjectsService.create/update — when upstreamUrl changes, all of that
 *     project's domains need their routes rebuilt.
 *
 * Implementation choice: we PUT the whole `:443` server config each time,
 * not PATCH individual routes. Atomicity + simplicity outweigh the extra
 * bytes; at O(1k) hostnames per reconcile the payload stays under 200 KB.
 * When we cross that bound (Phase 3 multi-region with tens of thousands
 * of hostnames), swap in the custom Caddy module from the Phase 4 roadmap.
 */
@Injectable()
export class CaddyReconcilerService implements OnApplicationBootstrap {
  private readonly log = new Logger(CaddyReconcilerService.name);
  private readonly serverKey: string;
  private readonly edgeNodeId: string | undefined;
  /** Inflight reconcile, for debouncing burst writes (register + add-to-primary). */
  private inflight: Promise<void> | null = null;

  constructor(
    @InjectRepository(Domain)
    private readonly domains: Repository<Domain>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    private readonly admin: CaddyAdminClient,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    this.serverKey = this.config.get<string>("CADDY_SERVER_KEY") ?? "customers";
    this.edgeNodeId = this.config.get<string>("EDGE_NODE_ID") ?? undefined;
  }

  async onApplicationBootstrap(): Promise<void> {
    // Boot reconcile is best-effort — a fresh edge node without Caddy yet
    // shouldn't block the control plane from starting.
    try {
      if (await this.admin.ping()) {
        await this.reconcile();
        this.log.log("boot reconcile complete");
      } else {
        this.log.warn("caddy admin unreachable on boot, skipping reconcile");
      }
    } catch (err) {
      this.log.warn(`boot reconcile failed: ${(err as Error).message}`);
    }
  }

  /**
   * Regenerate Caddy's :443 server config from the current DB state and
   * push it. Safe to call from multiple paths — an inflight reconcile
   * coalesces concurrent callers so we don't hammer the admin API during
   * a bulk import.
   */
  async reconcile(): Promise<void> {
    if (this.inflight) {
      await this.inflight;
      return;
    }
    this.inflight = this.doReconcile().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async doReconcile(): Promise<void> {
    const [allDomains, allProjects] = await Promise.all([
      this.domains.find({
        where: { removedAt: IsNull() },
        select: ["hostname", "projectId", "metadata", "verified"],
      }),
      this.projects.find({
        select: [
          "projectId",
          "slug",
          "upstreamUrl",
          "upstreamHost",
          "hostHeaderMode",
          "hostHeaderValue",
          "rateLimitRps",
          "enabled",
        ],
      }),
    ]);

    const serverConfig = buildServerConfig({
      domains: allDomains,
      projects: allProjects,
      edgeNodeId: this.edgeNodeId,
    });

    const path = `/config/apps/http/servers/${this.serverKey}`;
    try {
      await this.admin.putConfig(path, serverConfig);
      this.metrics.increment("hee_caddy_reconciles_total", { result: "success" });
    } catch (err) {
      this.metrics.increment("hee_caddy_reconciles_total", { result: "failure" });
      throw err;
    }

    this.log.log(
      `reconciled ${allDomains.length} hostname(s) across ${allProjects.filter((p) => p.enabled).length} project(s)`,
    );
  }
}
