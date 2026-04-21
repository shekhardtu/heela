import { Global, Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";

/**
 * Global so any service can @Inject(MetricsService) without re-importing
 * the module. Cheap: MetricsService is a single in-process singleton with
 * a Map backing it.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
