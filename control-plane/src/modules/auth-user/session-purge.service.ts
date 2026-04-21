import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { Session } from "../../entities/session.entity";

/**
 * Nightly hard-delete of sessions that can never be reactivated:
 *   - expired (expires_at < now)
 *   - revoked > 30 days ago (keep recent revokes for audit visibility)
 *
 * The portal's sliding-window refresh already stops reading expired rows;
 * this just keeps the sessions table from growing forever.
 */
@Injectable()
export class SessionPurgeService {
  private readonly log = new Logger(SessionPurgeService.name);

  constructor(
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
  ) {}

  @Cron("0 3 * * *", { name: "session-purge" })
  async tick(): Promise<void> {
    const now = new Date();
    const revokedCutoff = new Date(now.getTime() - 30 * 86_400_000);

    const expired = await this.sessions.delete({
      expiresAt: LessThan(now),
    });

    const revokedOld = await this.sessions
      .createQueryBuilder()
      .delete()
      .where("revoked_at IS NOT NULL AND revoked_at < :cutoff", {
        cutoff: revokedCutoff,
      })
      .execute();

    const total = (expired.affected ?? 0) + (revokedOld.affected ?? 0);
    if (total > 0) {
      this.log.log(
        `purged ${total} session(s): ${expired.affected ?? 0} expired, ${revokedOld.affected ?? 0} revoked-old`,
      );
    }
  }
}
