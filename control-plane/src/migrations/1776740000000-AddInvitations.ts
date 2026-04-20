import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds the project_invitations table for P2.5 member invites.
 *
 * Partial unique index on (project_id, email) WHERE accepted_at IS NULL AND
 * revoked_at IS NULL — stops duplicate live invites while allowing re-invites
 * after a revocation or past acceptance.
 *
 * This migration is mirrored in deploy.sh's psql fallback (TypeORM migrations
 * don't auto-run in the prod container).
 */
export class AddInvitations1776740000000 implements MigrationInterface {
  name = "AddInvitations1776740000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "project_invitations" (
        "invitationId" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "email" varchar(255) NOT NULL,
        "role" varchar(16) NOT NULL DEFAULT 'member',
        "invited_by_user_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "accepted_at" timestamptz,
        "revoked_at" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_invitations" PRIMARY KEY ("invitationId"),
        CONSTRAINT "FK_project_invitations_project"
          FOREIGN KEY ("project_id") REFERENCES "projects"("projectId") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX "IDX_invite_live_per_project_email"
         ON "project_invitations" ("project_id", "email")
         WHERE accepted_at IS NULL AND revoked_at IS NULL`,
    );
    await q.query(
      `CREATE INDEX "IDX_invite_token_hash"
         ON "project_invitations" ("token_hash")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "project_invitations"`);
  }
}
