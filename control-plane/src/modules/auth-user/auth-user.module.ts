import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProjectMember } from "../../entities/project-member.entity";
import { Session } from "../../entities/session.entity";
import { User } from "../../entities/user.entity";
import { AuthUserController } from "./auth-user.controller";
import { AuthUserService } from "./auth-user.service";
import { PostmarkService } from "./postmark.service";
import { SessionGuard } from "./session.guard";
import { SessionPurgeService } from "./session-purge.service";

@Module({
  imports: [TypeOrmModule.forFeature([User, Session, ProjectMember])],
  controllers: [AuthUserController],
  providers: [AuthUserService, PostmarkService, SessionGuard, SessionPurgeService],
  exports: [AuthUserService, SessionGuard, PostmarkService],
})
export class AuthUserModule {}
