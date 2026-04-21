import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Domain } from "../../entities/domain.entity";
import { Project } from "../../entities/project.entity";
import { AuthModule } from "../auth/auth.module";
import { CaddyModule } from "../caddy/caddy.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";
import { ErrorPageService } from "./error-page.service";
import { DomainVerifyService } from "./verify.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Domain, Project]),
    AuthModule,
    CaddyModule,
    WebhooksModule,
  ],
  controllers: [DomainsController],
  providers: [DomainsService, DomainVerifyService, ErrorPageService],
  exports: [DomainsService, ErrorPageService],
})
export class DomainsModule {}
