import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Domain } from "./domain.entity";

/**
 * A tenant. Each product that uses this edge (Colbin, YoFix, Kundali, and
 * eventually external customers) gets exactly one Project row.
 *
 * `upstreamUrl` is the default origin for every domain under this project.
 * Per-domain overrides can be added later via a nullable column on Domain.
 */
@Entity("projects")
export class Project {
  @PrimaryGeneratedColumn("uuid")
  projectId!: string;

  /** Human-readable name shown in dashboards. */
  @Column({ type: "varchar", length: 120 })
  name!: string;

  /** URL-safe slug. Unique across the platform. */
  @Index({ unique: true })
  @Column({ type: "varchar", length: 64 })
  slug!: string;

  /**
   * Default upstream URL (scheme + host, no path) where traffic for this
   * project's registered domains should be proxied. e.g. https://colbin.pages.dev
   */
  @Column({ type: "varchar", length: 255 })
  upstreamUrl!: string;

  /**
   * Optional explicit SNI / Host header to send to the upstream when proxying.
   * Defaults to the upstream hostname parsed from upstreamUrl.
   */
  @Column({ type: "varchar", length: 255, nullable: true })
  upstreamHost!: string | null;

  @Column({ type: "boolean", default: true })
  enabled!: boolean;

  /**
   * URL to a static HTML page served by the edge when the upstream returns
   * 5xx or is unreachable. Fetched once per minute and cached; if unset, the
   * edge serves Caddy's default 502 message.
   */
  @Column({ type: "varchar", length: 2048, nullable: true, name: "error_page_url" })
  errorPageUrl!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @OneToMany(() => Domain, (d) => d.project)
  domains!: Domain[];
}
