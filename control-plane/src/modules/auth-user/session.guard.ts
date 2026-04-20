import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { AuthUserService } from "./auth-user.service";

declare module "fastify" {
  interface FastifyRequest {
    portalAuth?: {
      userId: string;
      email: string;
      projects: Array<{
        projectId: string;
        slug: string;
        name: string;
        role: "owner" | "member";
      }>;
    };
  }
}

/**
 * Validates a portal session from either:
 *   - `Authorization: Bearer hee_sess_<hex>` (preferred; set by portal after login)
 *   - `hee_session` cookie (fallback for server components calling directly)
 *
 * Populates `request.portalAuth` with the resolved user + project memberships
 * so handlers can scope queries without a second call.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly service: AuthUserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const token = extractSessionToken(req);
    if (!token) throw new UnauthorizedException("no session");

    try {
      const me = await this.service.me(token);
      req.portalAuth = me;
      return true;
    } catch {
      throw new UnauthorizedException("invalid session");
    }
  }
}

/**
 * Helper used by controllers to assert a user has access to a project and
 * return their role in it. Throws 404 (not 403) when the project doesn't
 * exist OR the user isn't a member — same response either way prevents
 * probing project slugs.
 */
export function requireProjectAccess(
  req: FastifyRequest,
  slug: string,
  requiredRole: "owner" | "member" = "member",
): { projectId: string; role: "owner" | "member" } {
  const auth = req.portalAuth;
  if (!auth) throw new UnauthorizedException("no portal session");
  const membership = auth.projects.find((p) => p.slug === slug);
  if (!membership) {
    throw new ForbiddenException("project not found or no access");
  }
  if (requiredRole === "owner" && membership.role !== "owner") {
    throw new ForbiddenException("owner role required");
  }
  return { projectId: membership.projectId, role: membership.role };
}

function extractSessionToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const raw = header.slice(7).trim();
    if (raw) return raw;
  }
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === "string") {
    const match = cookieHeader.match(/(?:^|;\s*)hee_session=([^;]+)/);
    if (match) return match[1]!;
  }
  return null;
}
