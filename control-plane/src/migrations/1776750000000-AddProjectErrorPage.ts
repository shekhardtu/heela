import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProjectErrorPage1776750000000 implements MigrationInterface {
  name = "AddProjectErrorPage1776750000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "error_page_url" varchar(2048)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "error_page_url"`);
  }
}
