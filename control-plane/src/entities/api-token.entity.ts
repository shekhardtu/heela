import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Project } from "./project.entity";

/**
 * Long-lived API token used by a project's backend to register / remove
 * domains. Format: `hee_<32 hex>`. We store a SHA-256 hash of the token;
 * the raw value is returned exactly once at creation time.
 *
 * Tokens are NEVER bearer-scoped down to individual domains in Phase 1 — a
 * token is project-wide and can modify any domain under its project. Finer
 * scoping comes in Phase 3 (audit logs + per-resource tokens).
 */
@Entity("api_tokens")
export class ApiToken {
  @PrimaryGeneratedColumn("uuid")
  tokenId!: string;

  /**
   * SHA-256 hex of the token. Index for fast auth lookups.
   * Never log, never return — only the hash hits the wire in any response.
   */
  @Index({ unique: true })
  @Column({ type: "varchar", length: 64, name: "token_hash" })
  tokenHash!: string;

  /** First 8 chars of the token for humans to identify which one is which. */
  @Column({ type: "varchar", length: 16 })
  prefix!: string;

  @Index()
  @Column({ type: "uuid", name: "project_id" })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Project;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "timestamptz", nullable: true, name: "last_used_at" })
  lastUsedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true, name: "revoked_at" })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
