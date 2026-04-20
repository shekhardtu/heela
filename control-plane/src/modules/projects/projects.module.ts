import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiToken } from "../../entities/api-token.entity";
import { Project } from "../../entities/project.entity";
import { AdminTokenGuard } from "./admin-token.guard";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [TypeOrmModule.forFeature([Project, ApiToken])],
  controllers: [ProjectsController],
  providers: [ProjectsService, AdminTokenGuard],
})
export class ProjectsModule {}
