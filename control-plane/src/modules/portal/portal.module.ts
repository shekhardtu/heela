import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiToken } from "../../entities/api-token.entity";
import { Domain } from "../../entities/domain.entity";
import { ProjectInvitation } from "../../entities/project-invitation.entity";
import { ProjectMember } from "../../entities/project-member.entity";
import { Project } from "../../entities/project.entity";
import { User } from "../../entities/user.entity";
import { AuthUserModule } from "../auth-user/auth-user.module";
import { InvitationsService } from "./invitations.service";
import { PortalController } from "./portal.controller";
import { PortalService } from "./portal.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectMember,
      ProjectInvitation,
      ApiToken,
      Domain,
      User,
    ]),
    AuthUserModule,
  ],
  controllers: [PortalController],
  providers: [PortalService, InvitationsService],
})
export class PortalModule {}
