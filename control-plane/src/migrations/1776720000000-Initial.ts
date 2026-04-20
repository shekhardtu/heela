import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1776720000000 implements MigrationInterface {
  name = "Initial1776720000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await q.query(`
      CREATE TABLE "projects" (
        "projectId"      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name"           varchar(120) NOT NULL,
        "slug"           varchar(64)  NOT NULL,
        "upstreamUrl"    varchar(255) NOT NULL,
        "upstreamHost"   varchar(255),
        "enabled"        boolean      NOT NULL DEFAULT true,
        "createdAt"      timestamptz  NOT NULL DEFAULT now(),
        "updatedAt"      timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_projects_slug" UNIQUE ("slug")
      )
    `);

    await q.query(`
      CREATE TABLE "domains" (
        "domainId"   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "hostname"   varchar(255) NOT NULL,
        "project_id" uuid NOT NULL REFERENCES "projects"("projectId") ON DELETE CASCADE,
        "metadata"   jsonb NOT NULL DEFAULT '{}'::jsonb,
        "verified"   boolean NOT NULL DEFAULT false,
        "verifiedAt" timestamptz,
        "removed_at" timestamptz,
        "createdAt"  timestamptz NOT NULL DEFAULT now(),
        "updatedAt"  timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Unique hostname only among non-removed rows — lets a customer re-add a
    // domain they previously removed.
    await q.query(`
      CREATE UNIQUE INDEX "UQ_domains_hostname_active"
        ON "domains" ("hostname") WHERE "removed_at" IS NULL
    `);
    await q.query(`CREATE INDEX "IDX_domains_project" ON "domains" ("project_id")`);

    await q.query(`
      CREATE TABLE "api_tokens" (
        "tokenId"      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "token_hash"   varchar(64) NOT NULL,
        "prefix"       varchar(16) NOT NULL,
        "project_id"   uuid NOT NULL REFERENCES "projects"("projectId") ON DELETE CASCADE,
        "name"         varchar(120) NOT NULL,
        "last_used_at" timestamptz,
        "revoked_at"   timestamptz,
        "createdAt"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_api_tokens_hash" UNIQUE ("token_hash")
      )
    `);
    await q.query(`CREATE INDEX "IDX_api_tokens_project" ON "api_tokens" ("project_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "api_tokens"`);
    await q.query(`DROP TABLE "domains"`);
    await q.query(`DROP TABLE "projects"`);
  }
}
