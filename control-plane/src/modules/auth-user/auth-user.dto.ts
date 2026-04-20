import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class RequestMagicLinkDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  /** Where to redirect after successful callback. Validated server-side. */
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  redirectTo?: string;
}

export class MagicLinkCallbackDto {
  @IsString()
  token!: string;
}

export class SessionResponse {
  userId!: string;
  email!: string;
  name!: string | null;
  /** Raw session token — set as httpOnly cookie by the portal. Never logged. */
  sessionToken!: string;
  expiresAt!: string;
}

export class MeResponse {
  userId!: string;
  email!: string;
  name!: string | null;
  projects!: Array<{
    projectId: string;
    slug: string;
    name: string;
    role: "owner" | "member";
  }>;
}
