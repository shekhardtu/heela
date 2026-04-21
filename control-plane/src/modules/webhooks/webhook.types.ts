/**
 * Canonical webhook event schema. SDK mirrors these types verbatim so the
 * SaaS integrator gets type-safe handlers with no conversion boilerplate.
 *
 * Rules:
 *   - Every event has `event` (discriminator), `occurredAt` (ISO), `projectSlug`,
 *     and an event-specific payload.
 *   - Events are fire-and-forget: delivery is retried, ordering is best-effort.
 *     Receivers MUST treat them as idempotent (keyed by `event + hostname + occurredAt`).
 */

export interface BaseHeeEvent {
  /** ISO timestamp of when Hee observed the change. */
  occurredAt: string;
  /** Project slug — same as in /v1/edge/domains responses. */
  projectSlug: string;
}

export interface DomainVerifiedEvent extends BaseHeeEvent {
  event: "domain.verified";
  hostname: string;
}

export interface DomainProbeFailedEvent extends BaseHeeEvent {
  event: "domain.probe_failed";
  hostname: string;
  /** Short operator-friendly reason: "NXDOMAIN", "wrong target: foo.example.com", … */
  reason: string;
}

export interface CertIssuedEvent extends BaseHeeEvent {
  event: "cert.issued";
  hostname: string;
  /** ISO timestamp when the cert becomes invalid. */
  expiresAt: string;
}

export interface CertRenewalFailedEvent extends BaseHeeEvent {
  event: "cert.renewal_failed";
  hostname: string;
  reason: string;
  /** Cert expiry at the time of the failure. Lets receivers prioritise. */
  expiresAt: string;
}

export type HeeWebhookEvent =
  | DomainVerifiedEvent
  | DomainProbeFailedEvent
  | CertIssuedEvent
  | CertRenewalFailedEvent;
