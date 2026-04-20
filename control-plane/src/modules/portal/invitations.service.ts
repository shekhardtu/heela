import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes } from "node:crypto";
import { IsNull, Repository } from "typeorm";
import { ProjectInvitation } from "../../entities/project-invitation.entity";
import { ProjectMember } from "../../entities/project-member.entity";
import { Project } from "../../entities/project.entity";
import { User } from "../../entities/user.entity";
import { PostmarkService } from "../auth-user/postmark.service";
import {
  AcceptedInvitationResponse,
  CreateInvitationDto,
  InvitationCreatedResponse,
  PortalInvitationResponse,
  PortalMemberResponse,
} from "./portal.dto";

const INVITE_TTL_DAYS = 7;
const TOKEN_BYTES = 32;

/**
 * Invitation lifecycle:
 *   create → email sent → (accept | revoke | expire)
 *
 * Security model mirrors API tokens: we store sha256(token) only, the raw
 * token lives in the email. Clicking the link is the single source of truth
 * for proof of receipt. Revoked and accepted invites are retained for
 * auditability but aren't surfaced in the pending list.
 */
@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);
  private readonly portalBaseUrl: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(ProjectInvitation)
    private readonly invites: Repository<ProjectInvitation>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly postmark: PostmarkService,
  ) {
    this.portalBaseUrl = (
      this.config.get<string>("PORTAL_BASE_URL") ?? "https://app.hee.la"
    ).replace(/\/$/, "");
  }

  async invite(
    projectId: string,
    invitedByUserId: string,
    dto: CreateInvitationDto,
  ): Promise<InvitationCreatedResponse> {
    const email = dto.email.trim().toLowerCase();

    const project = await this.projects.findOne({ where: { projectId } });
    if (!project) throw new NotFoundException("project not found");

    // Already a member? Surface a clear error instead of silently sending mail.
    const existingMember = await this.members.findOne({
      where: { projectId, user: { email } },
      relations: ["user"],
    });
    if (existingMember) {
      throw new ConflictException("that email is already a member of this project");
    }

    // Live invitation already outstanding? Replace it rather than 409 — the
    // most recent link should be the valid one; older emails become no-ops.
    const existing = await this.invites.findOne({
      where: {
        projectId,
        email,
        acceptedAt: IsNull(),
        revokedAt: IsNull(),
      },
    });
    if (existing) {
      existing.revokedAt = new Date();
      await this.invites.save(existing);
    }

    const rawToken = randomBytes(TOKEN_BYTES).toString("hex");
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

    const row = await this.invites.save(
      this.invites.create({
        projectId,
        email,
        role: dto.role,
        invitedByUserId,
        tokenHash,
        expiresAt,
      }),
    );

    const acceptUrl = `${this.portalBaseUrl}/invite/accept?token=${encodeURIComponent(rawToken)}`;

    const inviter = await this.users.findOne({
      where: { userId: invitedByUserId },
    });

    try {
      await this.postmark.sendInvitation({
        to: email,
        link: acceptUrl,
        projectName: project.name,
        invitedByEmail: inviter?.email ?? null,
        role: dto.role,
      });
    } catch (err) {
      // Revert the invitation row if Postmark failed — don't leave a ghost
      // invite with no email backing it. The caller sees the send failure.
      await this.invites.remove(row);
      throw err;
    }

    return {
      invitationId: row.invitationId,
      email,
      role: dto.role,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      invitedByEmail: inviter?.email ?? null,
      acceptUrl,
    };
  }

  async listPending(projectId: string): Promise<PortalInvitationResponse[]> {
    const rows = await this.invites
      .createQueryBuilder("i")
      .leftJoinAndMapOne(
        "i.invitedByUser",
        User,
        "u",
        "u.userId = i.invited_by_user_id",
      )
      .where("i.project_id = :projectId", { projectId })
      .andWhere("i.accepted_at IS NULL")
      .andWhere("i.revoked_at IS NULL")
      .andWhere("i.expires_at > NOW()")
      .orderBy("i.createdAt", "DESC")
      .getMany();

    return rows.map((r) => ({
      invitationId: r.invitationId,
      email: r.email,
      role: r.role,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      invitedByEmail:
        ((r as unknown) as { invitedByUser?: { email: string } }).invitedByUser
          ?.email ?? null,
    }));
  }

  async listMembers(projectId: string): Promise<PortalMemberResponse[]> {
    const rows = await this.members.find({
      where: { projectId },
      relations: ["user"],
      order: { createdAt: "ASC" },
    });
    return rows.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
    }));
  }

  async revoke(projectId: string, invitationId: string): Promise<void> {
    const row = await this.invites.findOne({
      where: { invitationId, projectId },
    });
    if (!row) throw new NotFoundException("invitation not found");
    if (row.acceptedAt)
      throw new BadRequestException("invitation already accepted");
    if (row.revokedAt) return; // idempotent
    row.revokedAt = new Date();
    await this.invites.save(row);
  }

  /**
   * Called from `/v1/portal/invitations/accept` — the user is already
   * session-authenticated (they signed in via magic link on the accept page)
   * and we verify the invitation matches their email.
   */
  async accept(
    acceptingUserId: string,
    rawToken: string,
  ): Promise<AcceptedInvitationResponse> {
    const tokenHash = sha256Hex(rawToken);
    const invite = await this.invites.findOne({
      where: { tokenHash },
      relations: ["project"],
    });
    if (!invite) throw new NotFoundException("invitation not found");
    if (invite.revokedAt)
      throw new BadRequestException("invitation has been revoked");
    if (invite.acceptedAt)
      throw new BadRequestException("invitation already accepted");
    if (invite.expiresAt.getTime() < Date.now())
      throw new BadRequestException("invitation has expired");

    const user = await this.users.findOne({
      where: { userId: acceptingUserId },
    });
    if (!user) throw new ForbiddenException("user not found");
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException(
        `this invitation is for ${invite.email} — sign in with that email to accept`,
      );
    }

    // Concurrency: if the user is already a member (e.g. invited twice or
    // the first invite resolved in parallel), skip the insert but still mark
    // the invite consumed.
    const existing = await this.members.findOne({
      where: { projectId: invite.projectId, userId: user.userId },
    });
    if (!existing) {
      await this.members.save(
        this.members.create({
          projectId: invite.projectId,
          userId: user.userId,
          role: invite.role,
        }),
      );
    }

    invite.acceptedAt = new Date();
    await this.invites.save(invite);

    return {
      projectSlug: invite.project.slug,
      projectName: invite.project.name,
      role: invite.role,
    };
  }
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
