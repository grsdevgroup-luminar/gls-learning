import "reflect-metadata";
import * as Sentry from "@sentry/node";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import type { Env } from "./config/env";

async function bootstrap(): Promise<void> {
  // Initialise error tracking before anything else when a DSN is configured.
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0.1,
    });
  }

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true, // needed for Stripe webhook signature verification
  });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.enableCors({
    origin: config.get("WEB_ORIGIN", { infer: true }),
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("SkillStream API")
    .setDescription("Course platform backend")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  console.log(`API listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
