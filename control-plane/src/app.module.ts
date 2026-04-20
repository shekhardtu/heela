import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiToken } from "./entities/api-token.entity";
import { Domain } from "./entities/domain.entity";
import { ProjectMember } from "./entities/project-member.entity";
import { Project } from "./entities/project.entity";
import { Session } from "./entities/session.entity";
import { User } from "./entities/user.entity";
import { AuthUserModule } from "./modules/auth-user/auth-user.module";
import { DomainsModule } from "./modules/domains/domains.module";
import { EdgeModule } from "./modules/edge/edge.module";
import { PortalModule } from "./modules/portal/portal.module";
import { ProjectsModule } from "./modules/projects/projects.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        url: config.get<string>("DATABASE_URL"),
        entities: [Project, Domain, ApiToken, User, Session, ProjectMember],
        // Autoload migrations so `start:prod` applies them — safe for small
        // schemas. Once tables get hot, switch to explicit `npm run db:migrate`
        // at deploy time.
        migrationsRun: false,
        synchronize: false,
      }),
    }),
    AuthUserModule,
    DomainsModule,
    EdgeModule,
    PortalModule,
    ProjectsModule,
  ],
})
export class AppModule {}
