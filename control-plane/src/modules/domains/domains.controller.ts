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
import { DomainResponse, RegisterDomainDto } from "./domain.dto";
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
}
