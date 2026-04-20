import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiToken } from "../../entities/api-token.entity";
import { ProjectMember, type ProjectRole } from "../../entities/project-member.entity";
import { Project } from "../../entities/project.entity";
import { User } from "../../entities/user.entity";
import { generateApiToken } from "../auth/token.util";
import {
  AddMemberDto,
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
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
  ) {}

  async addMember(projectSlug: string, dto: AddMemberDto): Promise<{ userId: string; projectId: string; role: ProjectRole }> {
    const project = await this.projects.findOne({ where: { slug: projectSlug } });
    if (!project) throw new NotFoundException("project not found");

    const email = dto.email.trim().toLowerCase();
    let user = await this.users.findOne({ where: { email } });
    if (!user) {
      // Create a shell user so the invite lands on first sign-in.
      user = await this.users.save(this.users.create({ email }));
    }

    const existing = await this.members.findOne({
      where: { userId: user.userId, projectId: project.projectId },
    });
    if (existing) {
      if (dto.role && dto.role !== existing.role) {
        existing.role = dto.role;
        await this.members.save(existing);
      }
      return {
        userId: user.userId,
        projectId: project.projectId,
        role: existing.role,
      };
    }

    const member = await this.members.save(
      this.members.create({
        userId: user.userId,
        projectId: project.projectId,
        role: dto.role ?? "owner",
      }),
    );

    return {
      userId: user.userId,
      projectId: project.projectId,
      role: member.role,
    };
  }

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
