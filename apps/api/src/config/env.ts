import { z } from "zod";

// Validated environment. Fails fast at boot if anything required is missing.
export const envSchema = z.object({
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
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),

  // Optional integrations (wired in later phases)
  REDIS_URL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_STREAM_TOKEN: z.string().optional(),
  // Local playback-token signing (efficient DRM: no API call per play). Generate
  // once via `POST /accounts/:id/stream/keys`; store the returned id + base64 PEM.
  CLOUDFLARE_STREAM_KEY_ID: z.string().optional(),
  CLOUDFLARE_STREAM_KEY_PEM: z.string().optional(),
  // USD-base FX feed for the daily `Region.fxRate` refresh. The default is a
  // free, keyless endpoint covering the emerging-market currencies (BDT, NGN,
  // PKR) that ECB-sourced feeds like frankfurter.app omit.
  FX_RATES_URL: z.string().url().default("https://open.er-api.com/v6/latest/USD"),
  RESEND_API_KEY: z.string().optional(),
  // SMS reminders. Without all three, SmsService logs instead of sending.
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default("noreply@skillstream.dev"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  SENTRY_DSN: z.string().optional(),

  // Swagger docs. In production the docs are only mounted when both are set —
  // they describe every admin route, so they fail closed rather than open.
  DOCS_USER: z.string().optional(),
  DOCS_PASSWORD: z.string().optional(),
  // Public base URL of this API, used as the Swagger "try it out" target.
  // Defaults to a relative server, which is correct when docs are served
  // from the same origin as the API.
  PUBLIC_API_URL: z.string().url().optional(),
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
