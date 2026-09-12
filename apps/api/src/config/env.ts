import { z } from "zod";

// Validated environment. Fails fast at boot if anything required is missing.
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const logLevelSchema = z.enum([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
]);

const rawEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().url(),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(7),

  // Cookies / CORS
  COOKIE_DOMAIN: z.string().optional(),
  WEB_ORIGIN: z.string().url().default("http://localhost:3001"),

  // Optional integrations (wired in later phases)
  REDIS_URL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Stripe Connect Express onboarding. `RETURN_URL` = where Stripe sends the
  // instructor after they finish; `REFRESH_URL` = where Stripe sends them if
  // the hosted link expires mid-flow. Both required when payouts are enabled.
  STRIPE_CONNECT_RETURN_URL: z.string().url().optional(),
  STRIPE_CONNECT_REFRESH_URL: z.string().url().optional(),
  // Instructor payout fee model. Platform commission expressed in basis points
  // (500 = 5%). Minimum net (post-fee) below which a request is rejected.
  PAYOUT_PLATFORM_FEE_BPS: z.coerce
    .number()
    .int()
    .min(0)
    .max(10_000)
    .default(500),
  PAYOUT_MIN_NET_CENTS: z.coerce.number().int().min(100).default(2_500),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  // Sandbox (`api-m.sandbox.paypal.com`) vs live (`api-m.paypal.com`). Defaults
  // to sandbox in non-prod. Set to "true" in prod when the credentials come
  // from a sandbox app — live host rejects sandbox creds with `invalid_client`.
  PAYPAL_SANDBOX: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === undefined ? undefined : v === "true"),
  // SSLCommerz: store credentials from https://developer.sslcommerz.com. Without
  // both, the gateway is treated as unconfigured (dev-simulate outside prod).
  SSLCOMMERZ_STORE_ID: z.string().optional(),
  SSLCOMMERZ_STORE_PASSWD: z.string().optional(),
  // Sandbox (`sandbox.sslcommerz.com`) vs live (`securepay.sslcommerz.com`).
  // Defaults to sandbox in non-prod; prod must set this to "false" explicitly.
  SSLCOMMERZ_SANDBOX: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === undefined ? undefined : v === "true"),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_STREAM_TOKEN: z.string().optional(),
  // Local playback-token signing (efficient DRM: no API call per play). Generate
  // once via `POST /accounts/:id/stream/keys`; store the returned id + base64 PEM.
  CLOUDFLARE_STREAM_KEY_ID: z.string().optional(),
  CLOUDFLARE_STREAM_KEY_PEM: z.string().optional(),
  // Returned when registering the account webhook via Cloudflare Stream API.
  CLOUDFLARE_STREAM_WEBHOOK_SECRET: z.string().optional(),
  // Stream upload policy (tus). Defaults match Cloudflare + product limits.
  STREAM_MAX_DURATION_SECONDS: z.coerce.number().int().positive().default(7200),
  STREAM_MAX_OUTSTANDING_UPLOADS: z.coerce.number().int().positive().default(3),
  STREAM_UPLOAD_RESERVATION_HOURS: z.coerce.number().int().positive().default(24),
  STREAM_STALE_UPLOADING_HOURS: z.coerce.number().int().positive().default(48),
  STREAM_FAILED_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  // USD-base FX feed for the daily `Region.fxRate` refresh. The default is a
  // free, keyless endpoint covering the emerging-market currencies (BDT, NGN,
  // PKR) that ECB-sourced feeds like frankfurter.app omit.
  FX_RATES_URL: z.string().url().default("https://open.er-api.com/v6/latest/USD"),
  // Transactional email. `EMAIL_DRIVER` selects the transport adapter; the
  // service layer (templates + helpers) is provider-agnostic. Adding a new
  // provider = extend the enum + register an adapter in EmailModule.
  EMAIL_DRIVER: z.enum(["resend", "smtp", "log"]).optional(),
  RESEND_API_KEY: z.string().optional(),
  // Generic SMTP transport. Primary local use: Mailpit
  // (docker-compose service `mailpit`, SMTP :1025, UI :8025). Also usable
  // for any SMTP relay in staging.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // SMS reminders. Without all three, SmsService logs instead of sending.
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  // `EMAIL_FROM` is the new canonical key; `RESEND_FROM_EMAIL` is kept as a
  // legacy fallback so existing deployments keep booting during migration.
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_REPLY_TO: z.string().email().optional(),
  RESEND_FROM_EMAIL: z.string().email().default("noreply@grslearning.dev"),
  FRONTEND_URL: z.string().url().default("http://localhost:3001"),
  PLAYWRIGHT_EXECUTABLE_PATH: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  // Swagger docs. In production the docs are only mounted when both are set —
  // they describe every admin route, so they fail closed rather than open.
  DOCS_USER: z.string().optional(),
  DOCS_PASSWORD: z.string().optional(),
  // Public base URL of this API, used as the Swagger "try it out" target.
  // Defaults to a relative server, which is correct when docs are served
  // from the same origin as the API.
  PUBLIC_API_URL: optionalUrl,

  // MaxMind GeoIP — checkout location + VPN verification (see .env.example)
  GEOIP_CHECKOUT_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  MAXMIND_COUNTRY_DB_PATH: z.string().trim().min(1).optional(),
  MAXMIND_ANONYMOUS_IP_DB_PATH: z.string().trim().min(1).optional(),

  // Logging
  LOG_DESTINATION: z.enum(["file", "stdout"]).optional(),
  LOG_LEVEL: logLevelSchema.default("info"),
  LOG_DIR: z.string().trim().min(1).default("logs"),
  LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(14),

  // ── Storage (lesson resources) ─────────────────────────────────────────────
  // Driver selection: falls back to `local` in dev/test and `s3` in production
  // when unset. Override lets staging boxes point at the prod bucket safely.
  STORAGE_DRIVER: z.enum(["local", "s3"]).optional(),
  // Where LocalDriver writes files, relative to the API process cwd.
  STORAGE_LOCAL_DIR: z.string().trim().min(1).default("uploads"),
  // Per-file cap enforced by multer, also surfaced to the UI. 10 MB default.
  STORAGE_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  // Signed-URL lifetime for private buckets. Learners re-request the lesson
  // when they refresh, so ~1h is plenty and keeps leaked URLs short-lived.
  STORAGE_SIGNED_URL_TTL_SEC: z.coerce.number().int().positive().default(3600),

  // S3-compatible bucket (Railway, AWS S3, R2). All optional at parse time so
  // dev boots without credentials; a superRefine below enforces them when the
  // resolved driver is `s3`.
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Path-style URLs are required by most non-AWS S3 clones (Railway, MinIO).
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  // Optional CDN or public base to serve objects from when the bucket is
  // public-read. When set, drivers return `${base}/${key}` instead of signing.
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
});

export const envSchema = rawEnvSchema
  .transform((env) => ({
    ...env,
    LOG_DESTINATION:
      env.LOG_DESTINATION ??
      (env.NODE_ENV === "production" ? ("stdout" as const) : ("file" as const)),
    STORAGE_DRIVER:
      env.STORAGE_DRIVER ??
      (env.NODE_ENV === "production" ? ("s3" as const) : ("local" as const)),
    // Auto-resolve EMAIL_DRIVER: explicit setting wins; else prefer resend
    // when API key is present, then SMTP when host is set (Mailpit in dev),
    // else fall back to log (CI/no-config boot).
    EMAIL_DRIVER:
      env.EMAIL_DRIVER ??
      (env.RESEND_API_KEY
        ? ("resend" as const)
        : env.SMTP_HOST
          ? ("smtp" as const)
          : ("log" as const)),
    // Canonical from-address; legacy RESEND_FROM_EMAIL kept for one release.
    EMAIL_FROM: env.EMAIL_FROM ?? env.RESEND_FROM_EMAIL,
  }))
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.LOG_DESTINATION === "file") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["LOG_DESTINATION"],
        message: "LOG_DESTINATION must be stdout in production",
      });
    }
    if (env.EMAIL_DRIVER === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY is required when EMAIL_DRIVER=resend",
      });
    }
    if (env.EMAIL_DRIVER === "smtp" && !env.SMTP_HOST) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_HOST"],
        message: "SMTP_HOST is required when EMAIL_DRIVER=smtp",
      });
    }
    // Stripe Connect payouts require both redirect URLs whenever a Stripe key
    // is configured — onboarding can't complete without them.
    if (env.STRIPE_SECRET_KEY) {
      if (!env.STRIPE_CONNECT_RETURN_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_CONNECT_RETURN_URL"],
          message: "STRIPE_CONNECT_RETURN_URL is required when STRIPE_SECRET_KEY is set",
        });
      }
      if (!env.STRIPE_CONNECT_REFRESH_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_CONNECT_REFRESH_URL"],
          message: "STRIPE_CONNECT_REFRESH_URL is required when STRIPE_SECRET_KEY is set",
        });
      }
    }
    if (env.STORAGE_DRIVER === "s3") {
      const required = {
        S3_ENDPOINT: env.S3_ENDPOINT,
        S3_BUCKET: env.S3_BUCKET,
        S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
        S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY,
      } as const;
      for (const [key, value] of Object.entries(required)) {
        if (!value) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
