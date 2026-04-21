import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiToken } from "../../entities/api-token.entity";
import { ProjectMember } from "../../entities/project-member.entity";
import { Project } from "../../entities/project.entity";
import { User } from "../../entities/user.entity";
import { CaddyModule } from "../caddy/caddy.module";
import { AdminTokenGuard } from "./admin-token.guard";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ApiToken, User, ProjectMember]),
    CaddyModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, AdminTokenGuard],
})
export class ProjectsModule {}
