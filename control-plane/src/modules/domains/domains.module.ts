import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Domain } from "../../entities/domain.entity";
import { Project } from "../../entities/project.entity";
import { AuthModule } from "../auth/auth.module";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";

@Module({
  imports: [TypeOrmModule.forFeature([Domain, Project]), AuthModule],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
