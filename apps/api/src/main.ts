import "reflect-metadata";
import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/node";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import type { RequestHandler } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import type { Env } from "./config/env";

/**
 * Swagger UI is plain Express middleware, so the global JwtAuthGuard never sees
 * it — without this the full admin surface is readable by anyone who finds
 * /docs. Gate it on basic auth, and in production refuse to mount it at all
 * unless credentials are configured.
 */
function docsBasicAuth(user: string, password: string): RequestHandler {
  const expected = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
  return (req, res, next) => {
    const got = Buffer.from(req.headers.authorization ?? "");
    const want = Buffer.from(expected);
    if (got.length === want.length && timingSafeEqual(got, want)) {
      next();
      return;
    }
    res
      .set("WWW-Authenticate", 'Basic realm="SkillStream API docs"')
      .status(401)
      .send("Authentication required");
  };
}

function setupDocs(app: INestApplication, config: ConfigService<Env, true>): void {
  const isProd = config.get("NODE_ENV", { infer: true }) === "production";
  const user = config.get("DOCS_USER", { infer: true });
  const password = config.get("DOCS_PASSWORD", { infer: true });

  if (isProd && !(user && password)) {
    console.warn("Docs disabled: set DOCS_USER and DOCS_PASSWORD to enable in production");
    return;
  }
  if (user && password) {
    app.use(["/docs", "/docs-json"], docsBasicAuth(user, password));
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle("SkillStream API")
    .setDescription(
      [
        "Course platform backend.",
        "",
        "**Auth** — `POST /api/auth/login` sets httpOnly `access_token` and",
        "`refresh_token` cookies *and* returns an access token in the body.",
        "Browser clients ride the cookies; other clients send",
        "`Authorization: Bearer <accessToken>`. Use **Authorize** to try",
        "protected routes here. `POST /api/auth/refresh` reads the refresh",
        "cookie, so it only works from a browser session.",
        "",
        "**Errors** — validation failures return 400 with an `error` of",
        "`ValidationError` and a `message` array of `field: reason` strings.",
      ].join("\n"),
    )
    .setVersion("0.1.0")
    .addBearerAuth({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "Access token from POST /api/auth/login",
    })
    .addCookieAuth("access_token", {
      type: "apiKey",
      in: "cookie",
      description: "Set automatically by POST /api/auth/login",
    })
    .addServer(config.get("PUBLIC_API_URL", { infer: true }) ?? "/")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document, {
    jsonDocumentUrl: "docs-json",
    swaggerOptions: {
      // Keep the entered token across reloads; sorted so routes don't shuffle.
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
  });
}

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
  // crossOriginResourcePolicy: cross-site is disabled by default — this API is
  // consumed by a separate frontend origin (WEB_ORIGIN), so relax it there.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cookieParser());
  app.enableCors({
    origin: config.get("WEB_ORIGIN", { infer: true }),
    credentials: true,
  });

  setupDocs(app, config);

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  console.log(`API listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
