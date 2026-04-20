import {
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateProjectDto {
  @IsString()
  @MaxLength(120)
  @MinLength(1)
  name!: string;

  @Matches(/^[a-z0-9][a-z0-9-]{1,62}$/, {
    message: "slug must be lowercase, alphanumeric + dashes, 2-63 chars",
  })
  slug!: string;

  @IsUrl({ require_protocol: true, require_tld: false })
  upstreamUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  upstreamHost?: string;
}

export class IssueTokenDto {
  @IsString()
  @MaxLength(120)
  @MinLength(1)
  name!: string;
}

export class RegisterDomainDto {
  @Matches(
    /^(?=.{1,253}$)(?:(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)\.)+[A-Za-z]{2,}$/,
    { message: "hostname is not a valid FQDN" },
  )
  @MaxLength(253)
  hostname!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PortalProjectResponse {
  projectId!: string;
  name!: string;
  slug!: string;
  upstreamUrl!: string;
  upstreamHost!: string | null;
  enabled!: boolean;
  role!: "owner" | "member";
  domainCount!: number;
  tokenCount!: number;
  createdAt!: string;
}

export class PortalTokenResponse {
  tokenId!: string;
  name!: string;
  prefix!: string;
  lastUsedAt!: string | null;
  revokedAt!: string | null;
  createdAt!: string;
}

export class TokenCreatedResponse extends PortalTokenResponse {
  /** Raw token — shown exactly once. Portal surfaces this in a modal. */
  token!: string;
}

export class PortalDomainResponse {
  hostname!: string;
  verified!: boolean;
  verifiedAt!: string | null;
  metadata!: Record<string, unknown>;
  createdAt!: string;
}
