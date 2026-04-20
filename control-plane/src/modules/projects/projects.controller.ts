import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AdminTokenGuard } from "./admin-token.guard";
import {
  AddMemberDto,
  CreateProjectDto,
  IssueTokenDto,
  ProjectResponse,
  TokenCreatedResponse,
} from "./project.dto";
import { ProjectsService } from "./projects.service";

@Controller("v1/admin/projects")
@UseGuards(AdminTokenGuard)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Post()
  async create(@Body() dto: CreateProjectDto): Promise<ProjectResponse> {
    return this.service.create(dto);
  }

  @Get()
  async list(): Promise<ProjectResponse[]> {
    return this.service.list();
  }

  @Post(":slug/tokens")
  async issueToken(
    @Param("slug") slug: string,
    @Body() dto: IssueTokenDto,
  ): Promise<TokenCreatedResponse> {
    return this.service.issueToken(slug, dto);
  }

  @Post(":slug/members")
  async addMember(
    @Param("slug") slug: string,
    @Body() dto: AddMemberDto,
  ): Promise<{ userId: string; projectId: string; role: string }> {
    return this.service.addMember(slug, dto);
  }
}
