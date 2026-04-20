import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiToken } from "../../entities/api-token.entity";
import { Project } from "../../entities/project.entity";
import { generateApiToken } from "../auth/token.util";
import {
  CreateProjectDto,
  IssueTokenDto,
  ProjectResponse,
  TokenCreatedResponse,
} from "./project.dto";

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(ApiToken)
    private readonly tokens: Repository<ApiToken>,
  ) {}

  async create(dto: CreateProjectDto): Promise<ProjectResponse> {
    const existing = await this.projects.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException("slug already in use");

    const row = this.projects.create({
      name: dto.name,
      slug: dto.slug,
      upstreamUrl: dto.upstreamUrl,
      upstreamHost: dto.upstreamHost ?? null,
    });
    const saved = await this.projects.save(row);
    return this.toResponse(saved);
  }

  async list(): Promise<ProjectResponse[]> {
    const rows = await this.projects.find({ order: { createdAt: "DESC" } });
    return rows.map((r) => this.toResponse(r));
  }

  async issueToken(
    projectSlug: string,
    dto: IssueTokenDto,
  ): Promise<TokenCreatedResponse> {
    const project = await this.projects.findOne({ where: { slug: projectSlug } });
    if (!project) throw new NotFoundException("project not found");

    const generated = generateApiToken();
    const row = this.tokens.create({
      tokenHash: generated.hash,
      prefix: generated.prefix,
      projectId: project.projectId,
      name: dto.name,
    });
    const saved = await this.tokens.save(row);

    return {
      tokenId: saved.tokenId,
      prefix: saved.prefix,
      token: generated.raw,
      name: saved.name,
    };
  }

  private toResponse(p: Project): ProjectResponse {
    return {
      projectId: p.projectId,
      name: p.name,
      slug: p.slug,
      upstreamUrl: p.upstreamUrl,
      upstreamHost: p.upstreamHost,
      enabled: p.enabled,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
