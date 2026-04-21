import "reflect-metadata";
import { join } from "path";
import { DataSource } from "typeorm";
import { ApiToken } from "./entities/api-token.entity";
import { AuditEvent } from "./entities/audit-event.entity";
import { Domain } from "./entities/domain.entity";
import { ProjectInvitation } from "./entities/project-invitation.entity";
import { ProjectMember } from "./entities/project-member.entity";
import { Project } from "./entities/project.entity";
import { Session } from "./entities/session.entity";
import { User } from "./entities/user.entity";

/**
 * Standalone DataSource used by the TypeORM CLI for migrations.
 *
 * The `migrations` glob uses `__dirname` so it resolves correctly in both
 * contexts:
 *   - `src/data-source.ts`  → src/migrations/*.ts  (dev, via ts-node)
 *   - `dist/data-source.js` → dist/migrations/*.js (prod, via plain node)
 */
export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL ?? "postgres://hee:hee@localhost:5432/hee",
  entities: [
    Project,
    Domain,
    ApiToken,
    User,
    Session,
    ProjectMember,
    ProjectInvitation,
    AuditEvent,
  ],
  migrations: [join(__dirname, "migrations", "*.{ts,js}")],
  logging: process.env.TYPEORM_LOGGING === "true",
  synchronize: false,
});
