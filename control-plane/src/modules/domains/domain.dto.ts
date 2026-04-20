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

export class DomainResponse {
  hostname!: string;
  projectSlug!: string;
  verified!: boolean;
  verifiedAt!: string | null;
  createdAt!: string;
  metadata!: Record<string, unknown>;
}
