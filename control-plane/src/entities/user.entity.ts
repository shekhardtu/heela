import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Portal user — anyone who signs in to app.hee.la to manage their project's
 * domains. Membership in a project is tracked by ProjectMember (separate
 * join table) so one user can own multiple projects and one project can have
 * multiple admins.
 *
 * No password column — we're magic-link only. Session management lives in
 * the Session entity.
 */
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  userId!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 320 })
  email!: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  name!: string | null;

  @Column({ type: "timestamptz", nullable: true, name: "last_login_at" })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
