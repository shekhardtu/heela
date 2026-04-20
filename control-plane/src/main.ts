import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger UI is intentionally omitted in Phase 1 — requires @fastify/static
  // which we don't want as a runtime dep yet. Add back in Phase 2 alongside
  // the portal when users actually benefit from a docs page.

  const port = Number(process.env.PORT ?? 5301);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`[hee/control-plane] listening on :${port}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
