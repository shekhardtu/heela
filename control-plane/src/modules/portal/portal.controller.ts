import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  SessionGuard,
  requireProjectAccess,
} from "../auth-user/session.guard";
import { InvitationsService } from "./invitations.service";
import {
  AcceptInvitationDto,
  AcceptedInvitationResponse,
  CreateInvitationDto,
  CreateProjectDto,
  InvitationCreatedResponse,
  IssueTokenDto,
  PortalDomainResponse,
  PortalInvitationResponse,
  PortalMemberResponse,
  PortalProjectResponse,
  PortalTokenResponse,
  RegisterDomainDto,
  TokenCreatedResponse,
} from "./portal.dto";
import { PortalService } from "./portal.service";

/**
 * Portal endpoints — session-auth'd. These are what the Next.js app calls
 * on the user's behalf. All handlers enforce project membership via
 * `requireProjectAccess`; the controller never queries across tenants.
 */
@Controller("v1/portal")
@UseGuards(SessionGuard)
export class PortalController {
  constructor(
    private readonly service: PortalService,
    private readonly invites: InvitationsService,
  ) {}

  // ── Projects ──────────────────────────────────────────────────────────

  @Post("projects")
  async createProject(
    @Body() dto: CreateProjectDto,
    @Req() req: FastifyRequest,
  ): Promise<PortalProjectResponse> {
    return this.service.createProject(req.portalAuth!.userId, dto);
  }

  @Get("projects/:slug")
  async getProject(
    @Param("slug") slug: string,
    @Req() req: FastifyRequest,
  ): Promise<PortalProjectResponse> {
    const { projectId, role } = requireProjectAccess(req, slug);
    return this.service.getProject(projectId, role);
  }

  // ── Tokens ────────────────────────────────────────────────────────────

  @Post("projects/:slug/tokens")
  async issueToken(
    @Param("slug") slug: string,
    @Body() dto: IssueTokenDto,
    @Req() req: FastifyRequest,
  ): Promise<TokenCreatedResponse> {
    const { projectId } = requireProjectAccess(req, slug, "owner");
    return this.service.issueToken(projectId, dto);
  }

  @Get("projects/:slug/tokens")
  async listTokens(
    @Param("slug") slug: string,
    @Req() req: FastifyRequest,
  ): Promise<PortalTokenResponse[]> {
    const { projectId } = requireProjectAccess(req, slug);
    return this.service.listTokens(projectId);
  }

  @Delete("projects/:slug/tokens/:tokenId")
  @HttpCode(204)
  async revokeToken(
    @Param("slug") slug: string,
    @Param("tokenId") tokenId: string,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    const { projectId } = requireProjectAccess(req, slug, "owner");
    await this.service.revokeToken(projectId, tokenId);
  }

  // ── Domains ───────────────────────────────────────────────────────────

  @Post("projects/:slug/domains")
  async registerDomain(
    @Param("slug") slug: string,
    @Body() dto: RegisterDomainDto,
    @Req() req: FastifyRequest,
  ): Promise<PortalDomainResponse> {
    const { projectId } = requireProjectAccess(req, slug);
    return this.service.registerDomain(projectId, dto);
  }

  @Get("projects/:slug/domains")
  async listDomains(
    @Param("slug") slug: string,
    @Req() req: FastifyRequest,
  ): Promise<PortalDomainResponse[]> {
    const { projectId } = requireProjectAccess(req, slug);
    return this.service.listDomains(projectId);
  }

  @Delete("projects/:slug/domains/:hostname")
  @HttpCode(204)
  async removeDomain(
    @Param("slug") slug: string,
    @Param("hostname") hostname: string,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    const { projectId } = requireProjectAccess(req, slug);
    await this.service.removeDomain(projectId, hostname);
  }

  // ── Members + Invitations ─────────────────────────────────────────────

  @Get("projects/:slug/members")
  async listMembers(
    @Param("slug") slug: string,
    @Req() req: FastifyRequest,
  ): Promise<PortalMemberResponse[]> {
    const { projectId } = requireProjectAccess(req, slug);
    return this.invites.listMembers(projectId);
  }

  @Post("projects/:slug/invitations")
  async createInvitation(
    @Param("slug") slug: string,
    @Body() dto: CreateInvitationDto,
    @Req() req: FastifyRequest,
  ): Promise<InvitationCreatedResponse> {
    const { projectId } = requireProjectAccess(req, slug, "owner");
    return this.invites.invite(projectId, req.portalAuth!.userId, dto);
  }

  @Get("projects/:slug/invitations")
  async listInvitations(
    @Param("slug") slug: string,
    @Req() req: FastifyRequest,
  ): Promise<PortalInvitationResponse[]> {
    const { projectId } = requireProjectAccess(req, slug);
    return this.invites.listPending(projectId);
  }

  @Delete("projects/:slug/invitations/:invitationId")
  @HttpCode(204)
  async revokeInvitation(
    @Param("slug") slug: string,
    @Param("invitationId") invitationId: string,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    const { projectId } = requireProjectAccess(req, slug, "owner");
    await this.invites.revoke(projectId, invitationId);
  }

  // Accept is intentionally NOT scoped to a project — the token itself
  // carries the project, and the acceptor might not be a member yet.
  @Post("invitations/accept")
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @Req() req: FastifyRequest,
  ): Promise<AcceptedInvitationResponse> {
    return this.invites.accept(req.portalAuth!.userId, dto.token);
  }
}
