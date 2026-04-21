import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditEvent } from "../../entities/audit-event.entity";
import { AuditService } from "./audit.service";

/**
 * Global so any feature module can inject AuditService without needing
 * to thread the import through its own @Module definition.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
