import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  MagicLinkCallbackDto,
  MeResponse,
  RequestMagicLinkDto,
  SessionResponse,
} from "./auth-user.dto";
import { AuthUserService } from "./auth-user.service";

/**
 * Browser-facing auth endpoints. No guard on the magic-link / callback paths —
 * they're the bootstrap. `/me` and `/sign-out` require a session token; we
 * read it from the Authorization header since Fastify-cookie isn't wired
 * (and having the portal forward it explicitly keeps this stateless).
 */
@Controller("v1/auth")
export class AuthUserController {
  constructor(private readonly service: AuthUserService) {}

  @Post("request-magic-link")
  @HttpCode(204)
  async request(
    @Body() dto: RequestMagicLinkDto,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    const ip = extractClientIp(req);
    await this.service.requestMagicLink(dto.email, dto.redirectTo, ip);
  }

  @Post("callback")
  async callback(
    @Body() dto: MagicLinkCallbackDto,
    @Req() req: FastifyRequest,
  ): Promise<SessionResponse> {
    const ip = extractClientIp(req);
    const ua = typeof req.headers["user-agent"] === "string"
      ? req.headers["user-agent"]
      : null;
    return this.service.callback(dto.token, ip, ua);
  }

  @Get("me")
  async me(@Headers("authorization") auth?: string): Promise<MeResponse> {
    const token = parseBearer(auth);
    if (!token) throw new UnauthorizedException("missing session");
    return this.service.me(token);
  }

  @Post("sign-out")
  @HttpCode(204)
  async signOut(@Headers("authorization") auth?: string): Promise<void> {
    const token = parseBearer(auth);
    if (token) await this.service.signOut(token);
  }
}

function parseBearer(header: string | undefined): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

function extractClientIp(req: FastifyRequest): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0]!.trim();
  }
  return req.ip ?? null;
}
