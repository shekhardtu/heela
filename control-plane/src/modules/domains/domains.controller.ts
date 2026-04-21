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
import { ApiTokenGuard } from "../auth/api-token.guard";
import {
  BulkRegisterDomainDto,
  BulkRegisterResult,
  DomainResponse,
  RegisterDomainDto,
} from "./domain.dto";
import { DomainsService } from "./domains.service";

/**
 * Project-scoped domain management. All endpoints require a valid API token
 * for the owning project; the token's projectId is read from `request.auth`
 * (set by ApiTokenGuard) — callers never pass it explicitly.
 */
@Controller("v1/edge/domains")
@UseGuards(ApiTokenGuard)
export class DomainsController {
  constructor(private readonly service: DomainsService) {}

  @Post()
  async register(
    @Body() dto: RegisterDomainDto,
    @Req() req: FastifyRequest,
  ): Promise<DomainResponse> {
    return this.service.register(req.auth!.projectId, dto);
  }

  /**
   * Bulk register — POST /v1/edge/domains/bulk with `{ domains: [...] }`.
   * Each row is processed independently; one bad row doesn't fail the rest.
   */
  @Post("bulk")
  async registerBulk(
    @Body() dto: BulkRegisterDomainDto,
    @Req() req: FastifyRequest,
  ): Promise<BulkRegisterResult[]> {
    return this.service.registerBulk(req.auth!.projectId, dto);
  }

  @Get()
  async list(@Req() req: FastifyRequest): Promise<DomainResponse[]> {
    return this.service.list(req.auth!.projectId);
  }

  @Delete(":hostname")
  @HttpCode(204)
  async remove(
    @Param("hostname") hostname: string,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    await this.service.remove(req.auth!.projectId, hostname);
  }

  /**
   * Force a DNS probe for this hostname and return the freshly-updated
   * record (with diagnosis populated). Lets SaaS callers wire a "Re-verify"
   * button without waiting for the 5-min cron tick.
   */
  @Post(":hostname/diagnose")
  @HttpCode(200)
  async diagnose(
    @Param("hostname") hostname: string,
    @Req() req: FastifyRequest,
  ): Promise<DomainResponse> {
    return this.service.diagnose(req.auth!.projectId, hostname);
  }
}
