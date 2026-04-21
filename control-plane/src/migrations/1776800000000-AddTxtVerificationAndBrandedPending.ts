import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Optional TXT-based ownership verification (anti-hijack) and a customer-
 * brandable "setting up your domain" page URL per project. Both are
 * opt-in and backward-compatible with existing rows.
 */
export class AddTxtVerificationAndBrandedPending1776800000000
  implements MigrationInterface
{
  name = "AddTxtVerificationAndBrandedPending1776800000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "require_txt_verification" boolean NOT NULL DEFAULT false`,
    );
    await q.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "pending_page_url" varchar(2048)`,
    );
    await q.query(
      `ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "txt_challenge" varchar(64)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "domains" DROP COLUMN IF EXISTS "txt_challenge"`);
    await q.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "pending_page_url"`);
    await q.query(
      `ALTER TABLE "projects" DROP COLUMN IF EXISTS "require_txt_verification"`,
    );
  }
}
