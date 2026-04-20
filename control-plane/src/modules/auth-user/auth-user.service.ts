import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { IsNull, LessThan, MoreThan, Repository } from "typeorm";
import { ProjectMember } from "../../entities/project-member.entity";
import { Session } from "../../entities/session.entity";
import { User } from "../../entities/user.entity";
import { MeResponse, SessionResponse } from "./auth-user.dto";
import { PostmarkService } from "./postmark.service";

const MAGIC_LINK_TTL_SECONDS = 15 * 60; // 15 minutes
const SESSION_TTL_DAYS = 30;
const MAGIC_LINK_ISSUER = "hee-auth";
const MAGIC_LINK_AUDIENCE = "hee-portal";

@Injectable()
export class AuthUserService {
  private readonly logger = new Logger(AuthUserService.name);
  private readonly jwtKey: Uint8Array;
  private readonly portalBaseUrl: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
    private readonly postmark: PostmarkService,
  ) {
    const secret = this.config.get<string>("AUTH_JWT_SECRET");
    if (!secret) throw new Error("AUTH_JWT_SECRET is required");
    this.jwtKey = new TextEncoder().encode(secret);
    this.portalBaseUrl = (
      this.config.get<string>("PORTAL_BASE_URL") ?? "https://app.hee.la"
    ).replace(/\/$/, "");
  }

  /**
   * Always returns 204 regardless of whether the email matches a user — no
   * account-enumeration via timing or response shape. The email only gets
   * sent when the address is syntactically valid, which class-validator
   * already handled upstream.
   */
  async requestMagicLink(
    email: string,
    redirectTo: string | undefined,
    ip: string | null,
  ): Promise<void> {
    const normalized = email.trim().toLowerCase();

    // Find-or-create the user. Keeps the flow single-step (no separate signup).
    let user = await this.users.findOne({ where: { email: normalized } });
    if (!user) {
      user = await this.users.save(this.users.create({ email: normalized }));
    }

    const token = await new SignJWT({ sub: user.userId, redirectTo })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(MAGIC_LINK_ISSUER)
      .setAudience(MAGIC_LINK_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${MAGIC_LINK_TTL_SECONDS}s`)
      .sign(this.jwtKey);

    const link = `${this.portalBaseUrl}/api/auth/callback?token=${encodeURIComponent(token)}`;
    await this.postmark.sendMagicLink({ to: normalized, link, ip });
    this.logger.log(`magic link issued for ${normalized}`);
  }

  /**
   * Verifies the magic-link JWT, mints a session, returns the raw session token
   * for the portal to set as a cookie. The raw token only exists in this
   * response — the DB stores only its hash.
   */
  async callback(
    jwtToken: string,
    ip: string | null,
    userAgent: string | null,
  ): Promise<SessionResponse> {
    let payload: { sub?: string };
    try {
      const verified = await jwtVerify(jwtToken, this.jwtKey, {
        issuer: MAGIC_LINK_ISSUER,
        audience: MAGIC_LINK_AUDIENCE,
      });
      payload = verified.payload as { sub?: string };
    } catch (err) {
      this.logger.warn(`magic-link verify failed: ${(err as Error).message}`);
      throw new UnauthorizedException("invalid or expired link");
    }

    const userId = payload.sub;
    if (!userId) throw new UnauthorizedException("malformed token");

    const user = await this.users.findOne({ where: { userId } });
    if (!user) throw new UnauthorizedException("user not found");

    const sessionToken = `hee_sess_${randomBytes(32).toString("hex")}`;
    const hash = sha256(sessionToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400 * 1000);

    await this.sessions.save(
      this.sessions.create({
        tokenHash: hash,
        userId: user.userId,
        expiresAt,
        ip,
        userAgent,
      }),
    );

    user.lastLoginAt = new Date();
    await this.users.save(user);

    return {
      userId: user.userId,
      email: user.email,
      name: user.name,
      sessionToken,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Resolve a session-token cookie to the current user + their projects. Also
   * bumps the session's expiry (sliding window) — browsers that stay active
   * never re-auth mid-week.
   */
  async me(sessionToken: string): Promise<MeResponse> {
    if (!sessionToken || !sessionToken.startsWith("hee_sess_")) {
      throw new UnauthorizedException("no session");
    }
    const hash = sha256(sessionToken);
    const session = await this.sessions.findOne({
      where: { tokenHash: hash, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      relations: ["user"],
    });
    if (!session || !session.user) throw new UnauthorizedException("session expired");

    // Sliding expiry: extend expiresAt if we're more than halfway to expiry.
    const halfPoint = new Date(session.expiresAt.getTime() - (SESSION_TTL_DAYS / 2) * 86_400 * 1000);
    if (new Date() > halfPoint) {
      session.expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400 * 1000);
      await this.sessions.save(session);
    }

    const memberships = await this.members.find({
      where: { userId: session.userId },
      relations: ["project"],
      order: { createdAt: "ASC" },
    });

    return {
      userId: session.user.userId,
      email: session.user.email,
      name: session.user.name,
      projects: memberships
        .filter((m) => m.project)
        .map((m) => ({
          projectId: m.project.projectId,
          slug: m.project.slug,
          name: m.project.name,
          role: m.role,
        })),
    };
  }

  async signOut(sessionToken: string): Promise<void> {
    if (!sessionToken) return;
    const hash = sha256(sessionToken);
    await this.sessions.update({ tokenHash: hash }, { revokedAt: new Date() });
  }

  /** Periodic cleanup. Safe to call any time. */
  async purgeExpired(): Promise<number> {
    const res = await this.sessions.delete({ expiresAt: LessThan(new Date()) });
    return res.affected ?? 0;
  }
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
