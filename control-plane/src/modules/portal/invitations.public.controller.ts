import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { FastifyRequest } from "fastify";
import {
  AcceptInviteSessionResponse,
  AcceptInvitationDto,
} from "./portal.dto";
import { InvitationsService } from "./invitations.service";

/**
 * Public (unauth'd) endpoints for the invitation flow.
 *
 * The invite email link is itself proof of email possession, so accepting
 * via this endpoint creates-or-finds the user, adds them to the project,
 * AND mints a session in one shot. No separate magic-link signin needed.
 *
 * Rate-limited strictly because it's a token-probe target: an attacker
 * guessing random tokens should not be able to do it fast.
 */
@Controller("v1/invitations")
export class InvitationsPublicController {
  constructor(private readonly invites: InvitationsService) {}

  @Get("preview")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async preview(@Query("token") token: string) {
    if (!token || token.length < 32) {
      throw new BadRequestException("token required");
    }
    return this.invites.preview(token);
  }

  @Post("accept-via-token")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async accept(
    @Body() dto: AcceptInvitationDto,
    @Req() req: FastifyRequest,
    @Headers("user-agent") userAgent: string | undefined,
  ): Promise<AcceptInviteSessionResponse> {
    const ip = extractClientIp(req);
    const result = await this.invites.acceptAndMintSession(
      dto.token,
      ip,
      userAgent ?? null,
    );
    return {
      sessionToken: result.session.sessionToken,
      expiresAt: result.session.expiresAt,
      userId: result.session.userId,
      email: result.session.email,
      projectSlug: result.projectSlug,
      projectName: result.projectName,
      role: result.role,
    };
  }
}

function extractClientIp(req: FastifyRequest): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0]!.trim();
  }
  return req.ip ?? null;
}
