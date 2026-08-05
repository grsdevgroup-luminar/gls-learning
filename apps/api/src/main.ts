import "reflect-metadata";
import * as Sentry from "@sentry/node";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import type { Env } from "./config/env";
import { setupSwagger } from "./config/swagger.config";

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
    rawBody: true, // needed for Stripe webhook signature verification
  });

  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix("api");
  // crossOriginResourcePolicy: cross-site is disabled by default — this API is
  // consumed by a separate frontend origin (WEB_ORIGIN), so relax it there.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cookieParser());
  app.enableCors({
    origin: config.get("WEB_ORIGIN", { infer: true }),
    credentials: true,
  });

  setupSwagger(app, config);

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  console.log(`API listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
