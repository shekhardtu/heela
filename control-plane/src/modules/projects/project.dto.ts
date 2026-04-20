import { IsBoolean, IsOptional, IsString, IsUrl, Matches, MaxLength } from "class-validator";

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
}

export class ProjectResponse {
  projectId!: string;
  name!: string;
  slug!: string;
  upstreamUrl!: string;
  upstreamHost!: string | null;
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
