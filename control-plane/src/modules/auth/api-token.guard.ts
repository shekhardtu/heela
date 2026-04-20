import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { FastifyRequest } from "fastify";
import { IsNull, Repository } from "typeorm";
import { ApiToken } from "../../entities/api-token.entity";
import { hashToken } from "./token.util";

/**
 * Validates `Authorization: Bearer hee_<token>` on incoming requests.
 * Populates `request.auth` with the resolved project + token row so
 * downstream handlers can scope queries without re-doing the lookup.
 */
declare module "fastify" {
  interface FastifyRequest {
    auth?: {
      projectId: string;
      tokenId: string;
    };
  }
}

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiToken)
    private readonly tokens: Repository<ApiToken>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException("missing bearer token");
    }

    const raw = header.slice(7).trim();
    if (!raw.startsWith("hee_")) {
      throw new UnauthorizedException("invalid token format");
    }

    const hash = hashToken(raw);
    const row = await this.tokens.findOne({
      where: { tokenHash: hash, revokedAt: IsNull() },
    });

    if (!row) {
      throw new UnauthorizedException("unknown or revoked token");
    }

    // Fire-and-forget last-used update — don't await, don't fail the request
    // if the DB write is slow. Worst case: `lastUsedAt` lags by one request.
    this.tokens.update(row.tokenId, { lastUsedAt: new Date() }).catch(() => {});

    req.auth = {
      projectId: row.projectId,
      tokenId: row.tokenId,
    };

    return true;
  }
}
