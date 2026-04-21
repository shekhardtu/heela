import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds per-project rate limiting and cert lifecycle columns on domains so
 * the edge can enforce RPS caps per tenant and the webhook/UI layer can
 * surface cert expiry to operators.
 */
export class AddRateLimitAndCertLifecycle1776810000000
  implements MigrationInterface
{
  name = "AddRateLimitAndCertLifecycle1776810000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "rate_limit_rps" int`,
    );
    await q.query(
      `ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "cert_issued_at" timestamptz`,
    );
    await q.query(
      `ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "cert_expires_at" timestamptz`,
    );
    await q.query(
      `ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "cert_last_checked_at" timestamptz`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "domains" DROP COLUMN IF EXISTS "cert_last_checked_at"`);
    await q.query(`ALTER TABLE "domains" DROP COLUMN IF EXISTS "cert_expires_at"`);
    await q.query(`ALTER TABLE "domains" DROP COLUMN IF EXISTS "cert_issued_at"`);
    await q.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "rate_limit_rps"`);
  }
}
