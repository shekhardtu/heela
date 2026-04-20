import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuth1776730000000 implements MigrationInterface {
  name = "AddAuth1776730000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "users" (
        "userId"        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email"         varchar(320) NOT NULL,
        "name"          varchar(120),
        "last_login_at" timestamptz,
        "createdAt"     timestamptz NOT NULL DEFAULT now(),
        "updatedAt"     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await q.query(`
      CREATE TABLE "sessions" (
        "sessionId"   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "token_hash"  varchar(64) NOT NULL,
        "user_id"     uuid NOT NULL REFERENCES "users"("userId") ON DELETE CASCADE,
        "expires_at"  timestamptz NOT NULL,
        "revoked_at"  timestamptz,
        "ip"          varchar(64),
        "userAgent"   varchar(512),
        "createdAt"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_sessions_hash" UNIQUE ("token_hash")
      )
    `);
    await q.query(`CREATE INDEX "IDX_sessions_user" ON "sessions" ("user_id")`);

    await q.query(`
      CREATE TABLE "project_members" (
        "memberId"   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id"    uuid NOT NULL REFERENCES "users"("userId") ON DELETE CASCADE,
        "project_id" uuid NOT NULL REFERENCES "projects"("projectId") ON DELETE CASCADE,
        "role"       varchar(16) NOT NULL DEFAULT 'member',
        "createdAt"  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_project_members_user_project" UNIQUE ("user_id", "project_id")
      )
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "project_members"`);
    await q.query(`DROP TABLE "sessions"`);
    await q.query(`DROP TABLE "users"`);
  }
}
