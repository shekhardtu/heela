import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { Domain } from "../../entities/domain.entity";
import { Project } from "../../entities/project.entity";
import { DomainResponse, RegisterDomainDto } from "./domain.dto";

@Injectable()
export class DomainsService {
  constructor(
    @InjectRepository(Domain)
    private readonly domains: Repository<Domain>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

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

    const row = this.domains.create({
      hostname,
      projectId,
      metadata: dto.metadata ?? {},
    });
    const saved = await this.domains.save(row);
    saved.project = project;
    return this.toResponse(saved);
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
    };
  }
}
