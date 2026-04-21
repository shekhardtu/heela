import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength } from "class-validator";

/**
 * How the edge sets the `Host` header when proxying to the upstream.
 *   preserve             — send the client-facing hostname (default; lets
 *                          the SaaS upstream route per-tenant).
 *   rewrite_to_upstream  — overwrite with the upstream's own hostname (useful
 *                          when the upstream requires its hostname to match
 *                          TLS cert and doesn't do per-hostname routing).
 *   static               — set a literal value from `hostHeaderValue` (rare,
 *                          for upstreams that pin to a specific virtual host).
 */
export const HOST_HEADER_MODES = ["preserve", "rewrite_to_upstream", "static"] as const;
export type HostHeaderMode = (typeof HOST_HEADER_MODES)[number];

export class CreateProjectDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @Matches(/^[a-z0-9][a-z0-9-]{1,62}$/, {
    message: "slug must be lowercase, alphanumeric + dashes, 2-63 chars",
  })
  slug!: string;

  @IsUrl({ require_protocol: true, require_tld: false })
  upstreamUrl!: string;

  @IsOptional()
  @IsString()
  upstreamHost?: string;

  @IsOptional()
  @IsIn(HOST_HEADER_MODES)
  hostHeaderMode?: HostHeaderMode;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  hostHeaderValue?: string;
}

export class ProjectResponse {
  projectId!: string;
  name!: string;
  slug!: string;
  upstreamUrl!: string;
  upstreamHost!: string | null;
  hostHeaderMode!: HostHeaderMode;
  hostHeaderValue!: string | null;
  enabled!: boolean;
  createdAt!: string;
}

export class IssueTokenDto {
  @IsString()
  @MaxLength(120)
  name!: string;
}

export class AddMemberDto {
  @IsString()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  role?: "owner" | "member";
}

export class TokenCreatedResponse {
  tokenId!: string;
  prefix!: string;
  /** Raw token — shown once. Callers must store it securely. */
  token!: string;
  name!: string;
}
