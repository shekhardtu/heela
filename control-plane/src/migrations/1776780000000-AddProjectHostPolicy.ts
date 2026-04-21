import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Per-project host-header policy so upstreams that don't want the client
 * hostname (or want a specific literal) aren't forced into the default
 * "preserve" behaviour.
 */
export class AddProjectHostPolicy1776780000000 implements MigrationInterface {
  name = "AddProjectHostPolicy1776780000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "host_header_mode" varchar(32) NOT NULL DEFAULT 'preserve'`,
    );
    await q.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "host_header_value" varchar(255)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "host_header_value"`);
    await q.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "host_header_mode"`);
  }
}
