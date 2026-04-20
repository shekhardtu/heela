import "reflect-metadata";
import { DataSource } from "typeorm";
import { ApiToken } from "./entities/api-token.entity";
import { Domain } from "./entities/domain.entity";
import { Project } from "./entities/project.entity";

/**
 * Standalone DataSource used by the TypeORM CLI for migrations. Kept
 * separate from the Nest TypeOrmModule config so `typeorm migration:*`
 * commands don't require bootstrapping the full Nest app.
 */
export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL ?? "postgres://hee:hee@localhost:5432/hee",
  entities: [Project, Domain, ApiToken],
  migrations: ["src/migrations/*.ts"],
  logging: process.env.TYPEORM_LOGGING === "true",
  synchronize: false,
});
