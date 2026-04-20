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
import type { ProjectRole } from "./project-member.entity";

/**
 * A pending invitation for an email to join a project at a given role.
 *
 * The raw invitation token is never stored — only the SHA-256 hash. The token
 * is embedded in the email link; when the invitee clicks, we verify the hash
 * and mint a ProjectMember row.
 *
 * `acceptedAt` and `revokedAt` are mutually exclusive terminal states.
 * Expired invitations (expiresAt < now, not yet accepted/revoked) are garbage
 * collected lazily — the accept path rejects them.
 */
@Entity("project_invitations")
@Index(["projectId", "email"], {
  unique: true,
  where: "accepted_at IS NULL AND revoked_at IS NULL",
})
export class ProjectInvitation {
  @PrimaryGeneratedColumn("uuid")
  invitationId!: string;

  @Column({ type: "uuid", name: "project_id" })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Project;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 16, default: "member" })
  role!: ProjectRole;

  @Column({ type: "uuid", name: "invited_by_user_id" })
  invitedByUserId!: string;

  /** SHA-256 of the raw token (hex). Raw token lives only in the email. */
  @Column({ type: "varchar", length: 64, name: "token_hash" })
  tokenHash!: string;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;

  @Column({ type: "timestamptz", name: "accepted_at", nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: "timestamptz", name: "revoked_at", nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
