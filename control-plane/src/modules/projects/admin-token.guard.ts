import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyRequest } from "fastify";
import { tokensEqual } from "../auth/token.util";

/**
 * Guards project-admin endpoints (creating projects, issuing tokens) with a
 * single bootstrap token from env. Rotated by editing ADMIN_BOOTSTRAP_TOKEN
 * and restarting the service. Replaced by a proper user auth system in Phase 2
 * once the customer portal exists.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const header = req.headers.authorization;
    const expected = this.config.get<string>("ADMIN_BOOTSTRAP_TOKEN");

    if (!expected) {
      throw new UnauthorizedException("admin auth not configured");
    }
    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException("missing bearer token");
    }
    if (!tokensEqual(header.slice(7).trim(), expected)) {
      throw new UnauthorizedException("invalid admin token");
    }
    return true;
  }
}
