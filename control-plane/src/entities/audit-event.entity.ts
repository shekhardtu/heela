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
 * Append-only audit trail for tenant-scoped mutations.
 *
 *   action      — canonical verb: "project.update", "domain.register",
 *                 "domain.remove", "token.issue", "token.revoke",
 *                 "invite.create", "invite.revoke", "member.accept".
 *   actorType   — "user" (portal session) or "token" (API token).
 *   actorId     — userId or tokenId depending on actorType. Nullable only
 *                 for system-initiated events (future: cron cleanup).
 *   targetType  — "domain", "token", "project", "invitation", "member".
 *   targetId    — opaque string; hostname for domains, tokenId for tokens,
 *                 etc. Used for UI linking + search.
 *   metadata    — small JSON blob for before/after or contextual fields.
 *   ip          — source IP of the request, if available.
 *
 * Not intended for high-cardinality events (no per-request logs — use
 * application logs for that). Grows linearly with human-triggered actions.
 */
@Entity("audit_events")
@Index(["projectId", "createdAt"])
@Index(["projectId", "targetType", "targetId"])
export class AuditEvent {
  @PrimaryGeneratedColumn("uuid")
  auditEventId!: string;

  @Column({ type: "uuid", name: "project_id" })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Project;

  @Column({ type: "varchar", length: 64 })
  action!: string;

  @Column({ type: "varchar", length: 16, name: "actor_type" })
  actorType!: "user" | "token" | "system";

  @Column({ type: "uuid", name: "actor_id", nullable: true })
  actorId!: string | null;

  /** Email of the actor at event time. Denormalized — captures identity even
   *  if the user is later deleted. */
  @Column({ type: "varchar", length: 255, nullable: true, name: "actor_email" })
  actorEmail!: string | null;

  @Column({ type: "varchar", length: 32, name: "target_type" })
  targetType!: string;

  @Column({ type: "varchar", length: 255, name: "target_id" })
  targetId!: string;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ type: "varchar", length: 64, nullable: true })
  ip!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
