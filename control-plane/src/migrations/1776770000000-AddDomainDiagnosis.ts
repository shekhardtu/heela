import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds diagnosis columns to `domains` so every probe tick records what we
 * saw in DNS. The API returns these alongside `verified`/`verifiedAt` so
 * SaaS callers can render "detected vs expected" UX for their end customers
 * without running their own DNS probe.
 */
export class AddDomainDiagnosis1776770000000 implements MigrationInterface {
  name = "AddDomainDiagnosis1776770000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "last_probe_at" timestamptz`,
    );
    await q.query(
      `ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "last_observed_cname" varchar(255)`,
    );
    await q.query(
      `ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "last_probe_error" varchar(500)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "domains" DROP COLUMN IF EXISTS "last_probe_error"`);
    await q.query(`ALTER TABLE "domains" DROP COLUMN IF EXISTS "last_observed_cname"`);
    await q.query(`ALTER TABLE "domains" DROP COLUMN IF EXISTS "last_probe_at"`);
  }
}
