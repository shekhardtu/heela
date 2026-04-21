import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditEvent } from "../../entities/audit-event.entity";

export interface AuditLogInput {
  projectId: string;
  action: string;
  actorType: "user" | "token" | "system";
  actorId: string | null;
  actorEmail: string | null;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Services call `log()` inline from their mutation paths. Writes are
 * fire-and-forget relative to the caller's response — we await the insert
 * (so serial order matches HTTP order) but swallow errors, since a logging
 * failure must never fail the underlying mutation.
 *
 * For high-volume actions we'd switch to a BullMQ producer here; today
 * direct inserts handle all human-triggered traffic comfortably.
 */
@Injectable()
export class AuditService {
  private readonly log = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEvent)
    private readonly events: Repository<AuditEvent>,
  ) {}

  async record(input: AuditLogInput): Promise<void> {
    try {
      await this.events.save(
        this.events.create({
          projectId: input.projectId,
          action: input.action,
          actorType: input.actorType,
          actorId: input.actorId,
          actorEmail: input.actorEmail,
          targetType: input.targetType,
          targetId: input.targetId,
          metadata: input.metadata ?? {},
          ip: input.ip ?? null,
        }),
      );
    } catch (err) {
      this.log.warn(`audit write failed: ${(err as Error).message}`);
    }
  }

  async listForProject(
    projectId: string,
    limit = 100,
  ): Promise<AuditEvent[]> {
    return this.events.find({
      where: { projectId },
      order: { createdAt: "DESC" },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }
}
