import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiToken } from "../../entities/api-token.entity";
import { ApiTokenGuard } from "./api-token.guard";

@Module({
  imports: [TypeOrmModule.forFeature([ApiToken])],
  providers: [ApiTokenGuard],
  exports: [ApiTokenGuard, TypeOrmModule],
})
export class AuthModule {}
