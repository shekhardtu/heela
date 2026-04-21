import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Project } from "../../entities/project.entity";
import { WebhookDispatcherService } from "./webhook-dispatcher.service";

/**
 * Signs + delivers webhook events to SaaS operators. Exported so any
 * module that detects a state change (DomainVerifyService, future cert
 * lifecycle watcher) can inject the dispatcher and fire events.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  providers: [WebhookDispatcherService],
  exports: [WebhookDispatcherService],
})
export class WebhooksModule {}
