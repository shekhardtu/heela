import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { ApiToken } from "../../entities/api-token.entity";
import { Domain } from "../../entities/domain.entity";
import { ProjectMember } from "../../entities/project-member.entity";
import { Project } from "../../entities/project.entity";
import { generateApiToken } from "../auth/token.util";
import {
  CreateProjectDto,
  IssueTokenDto,
  PortalDomainResponse,
  PortalProjectResponse,
  PortalTokenResponse,
  RegisterDomainDto,
  TokenCreatedResponse,
} from "./portal.dto";

/**
 * Portal service — all operations are implicitly scoped by the caller's
 * project memberships (the controller threads `projectId` in after
 * authorization, we never trust a slug from the user directly for lookups).
 */
@Injectable()
export class PortalService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
    @InjectRepository(ApiToken)
    private readonly tokens: Repository<ApiToken>,
    @InjectRepository(Domain)
    private readonly domains: Repository<Domain>,
  ) {}

  // ── Projects ──────────────────────────────────────────────────────────

  async createProject(
    userId: string,
    dto: CreateProjectDto,
  ): Promise<PortalProjectResponse> {
    const slugTaken = await this.projects.findOne({ where: { slug: dto.slug } });
    if (slugTaken) throw new ConflictException("slug already in use");

    const project = await this.projects.save(
      this.projects.create({
        name: dto.name,
        slug: dto.slug,
        upstreamUrl: dto.upstreamUrl,
        upstreamHost: dto.upstreamHost ?? null,
      }),
    );

    await this.members.save(
      this.members.create({
        userId,
        projectId: project.projectId,
        role: "owner",
      }),
    );

    return {
      projectId: project.projectId,
      name: project.name,
      slug: project.slug,
      upstreamUrl: project.upstreamUrl,
      upstreamHost: project.upstreamHost,
      enabled: project.enabled,
      role: "owner",
      domainCount: 0,
      tokenCount: 0,
      createdAt: project.createdAt.toISOString(),
    };
  }

  async getProject(
    projectId: string,
    role: "owner" | "member",
  ): Promise<PortalProjectResponse> {
    const project = await this.projects.findOne({ where: { projectId } });
    if (!project) throw new NotFoundException("project not found");

    const [domainCount, tokenCount] = await Promise.all([
      this.domains.count({ where: { projectId, removedAt: IsNull() } }),
      this.tokens.count({ where: { projectId, revokedAt: IsNull() } }),
    ]);

    return {
      projectId: project.projectId,
      name: project.name,
      slug: project.slug,
      upstreamUrl: project.upstreamUrl,
      upstreamHost: project.upstreamHost,
      enabled: project.enabled,
      role,
      domainCount,
      tokenCount,
      createdAt: project.createdAt.toISOString(),
    };
  }

  // ── Tokens ────────────────────────────────────────────────────────────

  async issueToken(
    projectId: string,
    dto: IssueTokenDto,
  ): Promise<TokenCreatedResponse> {
    const generated = generateApiToken();
    const saved = await this.tokens.save(
      this.tokens.create({
        tokenHash: generated.hash,
        prefix: generated.prefix,
        projectId,
        name: dto.name,
      }),
    );
    return {
      tokenId: saved.tokenId,
      name: saved.name,
      prefix: saved.prefix,
      token: generated.raw,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async listTokens(projectId: string): Promise<PortalTokenResponse[]> {
    const rows = await this.tokens.find({
      where: { projectId },
      order: { createdAt: "DESC" },
    });
    return rows.map((t) => ({
      tokenId: t.tokenId,
      name: t.name,
      prefix: t.prefix,
      lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      revokedAt: t.revokedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async revokeToken(projectId: string, tokenId: string): Promise<void> {
    const token = await this.tokens.findOne({
      where: { tokenId, projectId },
    });
    if (!token) throw new NotFoundException("token not found");
    if (token.revokedAt) return; // idempotent
    token.revokedAt = new Date();
    await this.tokens.save(token);
  }

  // ── Domains ───────────────────────────────────────────────────────────

  async registerDomain(
    projectId: string,
    dto: RegisterDomainDto,
  ): Promise<PortalDomainResponse> {
    const hostname = dto.hostname.toLowerCase();

    const existing = await this.domains.findOne({
      where: { hostname, removedAt: IsNull() },
    });
    if (existing && existing.projectId !== projectId) {
      throw new ConflictException("hostname is already claimed");
    }
    if (existing) {
      if (dto.metadata) {
        existing.metadata = dto.metadata;
        await this.domains.save(existing);
      }
      return this.toDomainResponse(existing);
    }

    const row = await this.domains.save(
      this.domains.create({
        hostname,
        projectId,
        metadata: dto.metadata ?? {},
      }),
    );
    return this.toDomainResponse(row);
  }

  async listDomains(projectId: string): Promise<PortalDomainResponse[]> {
    const rows = await this.domains.find({
      where: { projectId, removedAt: IsNull() },
      order: { createdAt: "DESC" },
    });
    return rows.map((d) => this.toDomainResponse(d));
  }

  async removeDomain(projectId: string, hostname: string): Promise<void> {
    const row = await this.domains.findOne({
      where: {
        hostname: hostname.toLowerCase(),
        projectId,
        removedAt: IsNull(),
      },
    });
    if (!row) throw new NotFoundException("domain not found");
    row.removedAt = new Date();
    await this.domains.save(row);
  }

  private toDomainResponse(d: Domain): PortalDomainResponse {
    return {
      hostname: d.hostname,
      verified: d.verified,
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      metadata: d.metadata,
      createdAt: d.createdAt.toISOString(),
    };
  }
}
