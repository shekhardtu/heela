import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Webhook delivery config on Project. SaaS operators subscribe once per
 * project and receive signed events for every domain/cert lifecycle change —
 * no polling, no client-side reconciliation.
 */
export class AddProjectWebhooks1776790000000 implements MigrationInterface {
  name = "AddProjectWebhooks1776790000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "webhook_url" varchar(2048)`,
    );
    await q.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "webhook_secret" varchar(128)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "webhook_secret"`);
    await q.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "webhook_url"`);
  }
}
