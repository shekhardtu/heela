import {
  IsEmail,
  IsIn,
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

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  upstreamUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  upstreamHost?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2048)
  errorPageUrl?: string | null;
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
  errorPageUrl!: string | null;
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

export class CreateInvitationDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsIn(["owner", "member"])
  role!: "owner" | "member";
}

export class AcceptInvitationDto {
  @IsString()
  @MinLength(32)
  token!: string;
}

export class PortalInvitationResponse {
  invitationId!: string;
  email!: string;
  role!: "owner" | "member";
  expiresAt!: string;
  createdAt!: string;
  invitedByEmail!: string | null;
}

export class InvitationCreatedResponse extends PortalInvitationResponse {
  /** Full accept-link URL. Also emailed to the invitee. */
  acceptUrl!: string;
}

export class AcceptedInvitationResponse {
  projectSlug!: string;
  projectName!: string;
  role!: "owner" | "member";
}

export class AcceptInviteSessionResponse {
  sessionToken!: string;
  expiresAt!: string;
  userId!: string;
  email!: string;
  projectSlug!: string;
  projectName!: string;
  role!: "owner" | "member";
}

export class PortalMemberResponse {
  userId!: string;
  email!: string;
  role!: "owner" | "member";
  joinedAt!: string;
}

export class PortalAuditEventResponse {
  auditEventId!: string;
  action!: string;
  actorType!: "user" | "token" | "system";
  actorEmail!: string | null;
  targetType!: string;
  targetId!: string;
  metadata!: Record<string, unknown>;
  ip!: string | null;
  createdAt!: string;
}
