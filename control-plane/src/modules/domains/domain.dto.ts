import { IsObject, IsOptional, Matches, MaxLength } from "class-validator";

/**
 * FQDN regex: labels of 1-63 chars, dot-separated, TLD 2+ alpha.
 * Permissive enough for IDN (xn-- prefixed labels) — the on_demand_tls ask
 * hook does the real check against the registry.
 */
const FQDN_REGEX =
  /^(?=.{1,253}$)(?:(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)\.)+[A-Za-z]{2,}$/;

export class RegisterDomainDto {
  @Matches(FQDN_REGEX, { message: "hostname is not a valid FQDN" })
  @MaxLength(253)
  hostname!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DNS record the customer must set at their registrar for Hee to terminate
 * TLS and route traffic. The SaaS operator's UI should display these records
 * verbatim — no vendor-specific knowledge required on their side.
 */
export class VerificationRecord {
  /** DNS record type. */
  type!: "CNAME" | "TXT";
  /** The record name (usually the customer hostname). */
  name!: string;
  /** The expected value (for CNAME, the Hee edge hostname). */
  value!: string;
}

/**
 * Diagnosis signal populated by every DNS probe (cron or on-demand). Lets
 * SaaS callers render "detected vs expected" UX without running their own
 * DNS lookup. `observedCname` is what we saw; `expectedCname` is what we
 * need; `error` is a short operator-friendly reason (NXDOMAIN, wrong target, …).
 */
export class DomainDiagnosis {
  lastProbeAt!: string | null;
  observedCname!: string | null;
  expectedCname!: string;
  error!: string | null;
}

/**
 * Bulk input: an array of RegisterDomainDto wrapped so we can extend later
 * (e.g. add a common metadata default without breaking callers).
 */
export class BulkRegisterDomainDto {
  domains!: RegisterDomainDto[];
}

export class BulkRegisterResult {
  hostname!: string;
  status!: "created" | "updated" | "conflict" | "error";
  /** Populated on success. Null on conflict/error. */
  record!: DomainResponse | null;
  error!: string | null;
}

/**
 * Cert lifecycle fields surfaced to the SaaS operator. Issued/expires come
 * from whatever cert is currently served for this hostname (Let's Encrypt
 * via Caddy). `lastCheckedAt` is populated every time the cert watcher
 * runs so UIs can age-out stale data.
 */
export class DomainCertLifecycle {
  issuedAt!: string | null;
  expiresAt!: string | null;
  lastCheckedAt!: string | null;
}

export class DomainResponse {
  hostname!: string;
  projectSlug!: string;
  verified!: boolean;
  verifiedAt!: string | null;
  createdAt!: string;
  metadata!: Record<string, unknown>;
  /**
   * Records the customer must set in DNS. Returned on register/list/get so
   * callers never hardcode the edge hostname. Lets Hee swap its edge without
   * every SaaS integrator shipping a config change.
   */
  verificationRecords!: VerificationRecord[];
  /** Last DNS probe result. Null before the first probe has run. */
  diagnosis!: DomainDiagnosis;
  /** TLS certificate lifecycle. All fields null until the first cert issues. */
  cert!: DomainCertLifecycle;
}
