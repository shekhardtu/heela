import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditEvents1776760000000 implements MigrationInterface {
  name = "AddAuditEvents1776760000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "audit_events" (
        "auditEventId" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "action" varchar(64) NOT NULL,
        "actor_type" varchar(16) NOT NULL,
        "actor_id" uuid,
        "actor_email" varchar(255),
        "target_type" varchar(32) NOT NULL,
        "target_id" varchar(255) NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "ip" varchar(64),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_events" PRIMARY KEY ("auditEventId"),
        CONSTRAINT "FK_audit_events_project"
          FOREIGN KEY ("project_id") REFERENCES "projects"("projectId") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE INDEX "IDX_audit_project_time" ON "audit_events" ("project_id", "createdAt" DESC)`,
    );
    await q.query(
      `CREATE INDEX "IDX_audit_project_target"
         ON "audit_events" ("project_id", "target_type", "target_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "audit_events"`);
  }
}
