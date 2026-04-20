import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./user.entity";

/**
 * A web session cookie. The raw session token hits the browser as an httpOnly
 * cookie; we store only its SHA-256 hash for lookup. Sessions last 30 days,
 * sliding window refreshed on use.
 */
@Entity("sessions")
export class Session {
  @PrimaryGeneratedColumn("uuid")
  sessionId!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 64, name: "token_hash" })
  tokenHash!: string;

  @Index()
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;

  @Column({ type: "timestamptz", nullable: true, name: "revoked_at" })
  revokedAt!: Date | null;

  /** IP + user-agent of the browser that created the session — for audit logs. */
  @Column({ type: "varchar", length: 64, nullable: true })
  ip!: string | null;

  @Column({ type: "varchar", length: 512, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
