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

  /**
   * How the edge sets `Host` when proxying. `preserve` (default) forwards
   * the client-facing hostname so multi-tenant upstreams can route per
   * customer; `rewrite_to_upstream` uses the upstream URL's host (for
   * upstreams that require a fixed vhost); `static` uses `hostHeaderValue`.
   */
  @Column({
    type: "varchar",
    length: 32,
    default: "preserve",
    name: "host_header_mode",
  })
  hostHeaderMode!: "preserve" | "rewrite_to_upstream" | "static";

  /** Only read when `hostHeaderMode === "static"`. */
  @Column({ type: "varchar", length: 255, nullable: true, name: "host_header_value" })
  hostHeaderValue!: string | null;

  @Column({ type: "boolean", default: true })
  enabled!: boolean;

  /**
   * URL to a static HTML page served by the edge when the upstream returns
   * 5xx or is unreachable. Fetched once per minute and cached; if unset, the
   * edge serves Caddy's default 502 message.
   */
  @Column({ type: "varchar", length: 2048, nullable: true, name: "error_page_url" })
  errorPageUrl!: string | null;

  /**
   * URL we POST webhook events to (domain.verified, cert.renewal_failed, …).
   * Signed with `webhookSecret` using HMAC-SHA256 in the X-Hee-Signature header.
   * Unset = no webhooks for this project.
   */
  @Column({ type: "varchar", length: 2048, nullable: true, name: "webhook_url" })
  webhookUrl!: string | null;

  /** Shared secret used for webhook HMAC signature. Rotated via portal. */
  @Column({ type: "varchar", length: 128, nullable: true, name: "webhook_secret" })
  webhookSecret!: string | null;

  /**
   * When true, domain registration returns a one-time TXT challenge. The
   * verify cron won't flip `verified=true` until it sees both the CNAME and
   * the TXT record. Anti-hijack — an attacker who CNAMEs a hostname they
   * don't own still can't claim it without write access to the zone.
   */
  @Column({
    type: "boolean",
    default: false,
    name: "require_txt_verification",
  })
  requireTxtVerification!: boolean;

  /**
   * URL the edge fetches + serves when a registered hostname is present but
   * `verified === false`. Lets the SaaS operator show their own branded
   * "setting up your domain" page instead of a generic Hee placeholder.
   */
  @Column({ type: "varchar", length: 2048, nullable: true, name: "pending_page_url" })
  pendingPageUrl!: string | null;

  /**
   * Per-project rate limit cap for edge traffic, in requests per second.
   * Null = no per-project limit (platform-wide global still applies).
   * Caddy uses this via a token-bucket applied per Host header bucket.
   */
  @Column({ type: "int", nullable: true, name: "rate_limit_rps" })
  rateLimitRps!: number | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @OneToMany(() => Domain, (d) => d.project)
  domains!: Domain[];
}
