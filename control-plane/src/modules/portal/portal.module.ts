import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiToken } from "../../entities/api-token.entity";
import { Domain } from "../../entities/domain.entity";
import { ProjectMember } from "../../entities/project-member.entity";
import { Project } from "../../entities/project.entity";
import { AuthUserModule } from "../auth-user/auth-user.module";
import { PortalController } from "./portal.controller";
import { PortalService } from "./portal.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectMember, ApiToken, Domain]),
    AuthUserModule,
  ],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
