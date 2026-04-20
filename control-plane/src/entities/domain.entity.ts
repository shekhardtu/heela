import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Project } from "./project.entity";

/**
 * A customer-owned hostname registered for routing through this edge.
 *
 * `hostname` is the full FQDN the customer controls (e.g. engineering.loopai.com).
 * `verified` flips to true once DNS + a first successful request through the
 * edge confirm the customer set up CNAME correctly. Until then, on_demand_tls
 * `ask` still allows cert issuance — the verification is a UX signal, not a
 * security gate.
 *
 * `removedAt` is a soft-delete tombstone. Hard delete is reserved for GDPR
 * requests. This lets us keep the cert and serve stale traffic briefly if the
 * customer accidentally removes + re-adds the domain.
 */
@Entity("domains")
@Index(["hostname"], { unique: true, where: "removed_at IS NULL" })
export class Domain {
  @PrimaryGeneratedColumn("uuid")
  domainId!: string;

  /** Lowercased FQDN. Unique across all projects (one hostname, one owner). */
  @Column({ type: "varchar", length: 255 })
  hostname!: string;

  @Index()
  @Column({ type: "uuid", name: "project_id" })
  projectId!: string;

  @ManyToOne(() => Project, (p) => p.domains, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Project;

  /**
   * Opaque metadata the owning project attaches to this domain. We don't
   * interpret it — just pass it back via /v1/edge/resolve so the caller can
   * route within the tenant (workspace id, theme override, anything).
   */
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ type: "boolean", default: false })
  verified!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  verifiedAt!: Date | null;

  @Column({ type: "timestamptz", name: "removed_at", nullable: true })
  removedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
