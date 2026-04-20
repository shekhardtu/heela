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
import { User } from "./user.entity";

/**
 * N-to-N between users and projects. `role` is coarse in Phase 2 — just
 * `owner` / `member`. Finer permissions land in Phase 3 alongside audit logs.
 */
export type ProjectRole = "owner" | "member";

@Entity("project_members")
@Index(["userId", "projectId"], { unique: true })
export class ProjectMember {
  @PrimaryGeneratedColumn("uuid")
  memberId!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "uuid", name: "project_id" })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Project;

  @Column({ type: "varchar", length: 16, default: "member" })
  role!: ProjectRole;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
