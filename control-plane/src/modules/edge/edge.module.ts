import { Module } from "@nestjs/common";
import { DomainsModule } from "../domains/domains.module";
import { EdgeController } from "./edge.controller";

@Module({
  imports: [DomainsModule],
  controllers: [EdgeController],
})
export class EdgeModule {}
