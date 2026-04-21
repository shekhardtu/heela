import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Domain } from "../../entities/domain.entity";
import { Project } from "../../entities/project.entity";
import { CaddyAdminClient } from "./caddy-admin.client";
import { CaddyReconcilerService } from "./caddy-reconciler.service";

/**
 * Owns everything edge-routing-related: the thin Caddy admin HTTP client,
 * the reconciler that keeps per-hostname routes in sync with Postgres, and
 * (in future phases) a Caddy-plugin-based alternative.
 *
 * Exported so DomainsModule and ProjectsModule can inject the reconciler
 * to trigger re-sync after every write.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Domain, Project])],
  providers: [CaddyAdminClient, CaddyReconcilerService],
  exports: [CaddyReconcilerService],
})
export class CaddyModule {}
