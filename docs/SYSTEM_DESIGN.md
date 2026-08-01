# SkillStream — System Design

> Companion to [`FEATURE_FLOWS.md`](./FEATURE_FLOWS.md) (every role/feature as a
> step-by-step flow). This document is the architecture map: how the pieces fit
> together, the data model, and the operational concerns — read this first to get
> your bearings, then use `FEATURE_FLOWS.md` to answer "how does X actually work?"

## 1. Shape of the system

```
┌─────────────────────┐        HTTPS (cookies + Bearer)        ┌──────────────────────┐
│  apps/web            │ ───────────────────────────────────▶ │  apps/api             │
│  Next.js 16 App      │ ◀─────────────────────────────────── │  NestJS 11            │
│  Router, React 19    │              JSON, /api prefix         │  /api/*                │
└──────────┬───────────┘                                       └──────────┬────────────┘
           │ proxy.ts (renamed middleware): UX-only auth redirect          │
           │                                                               │
           ▼                                                               ▼
   Cloudflare Stream            Stripe / PayPal            PostgreSQL 16 (Prisma 6)
   (direct upload +             (checkout + webhooks)      Redis 7 (BullMQ queues)
   signed HLS playback)                                    Resend (email) / Twilio (SMS)
```

- **`apps/web`** never talks to Postgres, Stripe, or Cloudflare directly — every
  read/write goes through the NestJS API (`lib/api` is the one typed fetch client).
  The one exception is video *bytes*: the browser uploads the raw file straight to
  Cloudflare Stream after the API hands it a one-time upload URL, so large media
  never transits the SkillStream server.
- **`apps/api`** is the only thing that talks to the database, the payment
  gateways, and Cloudflare's management API. It is the single source of truth and
  the only place authorization is actually enforced (see §3).
- **`packages/shared`** holds Zod schemas, enums, and pure business logic (money
  math, coupon/PPP pricing, progress calculation) imported by both apps, so a
  price or a role enum can't drift between frontend and backend.

## 2. Request lifecycle (API)

`apps/api/src/main.ts` bootstraps in this order — worth knowing when debugging
"why didn't my request get to my code":

1. Sentry init (if `SENTRY_DSN` set) — before anything else, so early boot
   failures are captured too.
2. `helmet()` with `crossOriginResourcePolicy: cross-origin` (the API is a
   separate origin from the web app).
3. `cookieParser()`, then CORS scoped to `WEB_ORIGIN` with `credentials: true`.
4. Swagger (`/docs`, `/docs-json`) — basic-auth gated, and refuses to mount at
   all in production unless `DOCS_USER`/`DOCS_PASSWORD` are set (fails closed,
   since the spec documents the entire admin surface).
5. `app.setGlobalPrefix("api")` — every route below is under `/api`.

Per-request, `app.module.ts` registers these globally, in this order:
`JwtAuthGuard` → `RolesGuard` → `ThrottlerGuard`, then `AuditInterceptor`, with
`AllExceptionsFilter` catching anything unhandled into a uniform error shape.

- **`JwtAuthGuard`**: every route requires a valid access-token JWT unless
  decorated `@Public()`. Re-fetches the user from the DB on every request (not
  just decoding the JWT), so a deleted/demoted user's still-valid token stops
  working immediately.
- **`RolesGuard`**: enforces `@Roles("ADMIN", ...)` where present. Sales-agent
  and org-admin authorization is deliberately **not** modeled here — it's
  contextual ("admin of *this* org"), so those checks live inline in the
  relevant service instead.
- **`ThrottlerGuard`**: global default 120 req/min per client; specific auth
  routes (login, register, forgot-password) set tighter per-route limits.
- **`AuditInterceptor`**: writes an `AuditLog` row for mutating requests.

Domain code is organized as one Nest module per bounded area under
`apps/api/src/*` — `auth`, `courses`, `authoring` (instructor course builder),
`enrollment`, `quiz`, `certificates`, `commerce` (cart/checkout/orders/coupons/
pricing/payments+webhooks), `reviews`, `comments`, `instructor`, `sales-agent`,
`organizations`, `payouts`, `admin`, `media` (Cloudflare Stream), `email` (email
+ SMS + admin alerts), `jobs` (BullMQ processors), `users`, `notes`. `common/`
holds the cross-cutting guards/filters/interceptors above.

## 3. Authorization model

Two layers, asymmetric on purpose — see `FEATURE_FLOWS.md` §0 for the full
per-role breakdown:

- **API (authoritative)**: `JwtAuthGuard` + `RolesGuard`, described above. This
  is the only layer that actually blocks anything.
- **Web (`apps/web/proxy.ts`, UX only)**: Next.js 16's renamed middleware
  redirects unauthenticated visitors to `/login`, and for `/admin`/`/instructor`
  specifically decodes (*without* verifying the signature) the JWT's `role`
  claim to bounce a mismatched role home. It's a UX shortcut, not a security
  boundary — the API would refuse the request either way.

## 4. Data model

Full schema: `apps/api/prisma/schema.prisma` (Postgres via Prisma 6). Grouped by
area — see the schema's own section comments for the authoritative model list:

| Area | Key models |
|---|---|
| Identity & roles | `User`, `RefreshToken`, `PasswordResetToken`, `StudentProfile`, `InstructorProfile`, `InstructorApplication` |
| Catalog | `Course`, `Section`, `Lesson`, `Quiz`, `QuizQuestion`, `QuizOption` |
| Learning | `Enrollment`, `LessonProgress`, `LessonNote`, `QuizResult`, `QuizAttempt`, `Certificate` |
| Engagement | `Review`, `Comment` |
| Commerce | `Order`, `OrderItem`, `Coupon`, `CouponRedemption` |
| Pricing / localization | `PricingTier`, `CountryOverride`, `Region` |
| Marketing | `AutomationRule`, `ReminderLog` |
| Ops | `PlatformSettings` (singleton row), `AuditLog`, `WebhookEvent` |
| Sales agents | `SalesAgent`, `SalesAgentApplication`, `SalesAgentReferral` |
| B2B orgs | `Organization`, `OrgMember`, `OrgInvitation` |
| Payouts | `PayoutAccount`, `Payout` |

Conventions that hold everywhere:
- **Money is integer cents**, never floating point (`basePriceCents`,
  `amountCents`, etc.).
- **IDs are `cuid()`** strings, except natural keys used as PKs directly
  (`Coupon.code`, `Region.code`, `PlatformSettings.id = "singleton"`).
- **Snapshots over live references** where history must not drift:
  `OrderItem.titleSnapshot`/`priceCents`, `Payout.destination`.
- **Enums are mirrored in `packages/shared`** so both apps get the same type
  without importing Prisma client into the frontend.

## 5. Background jobs (Redis + BullMQ)

`apps/api/src/jobs/`, all designed to fail safe (skip a bad row, keep the last
known value) rather than crash or emit bad data:

| Job | Cadence | Does |
|---|---|---|
| Consistency rollup | hourly | Reconciles derived counters (course student counts, ratings) against source rows |
| Marketing automation sweep | hourly | Evaluates `AutomationRule` triggers against real activity, respects per-trigger cooldown, sends via email/SMS, logs to `ReminderLog` |
| FX rate refresh | daily | Refreshes `Region.fxRate` from `FX_RATES_URL`; on failure keeps the last rate (checkout always charges in USD, so a stale *display* rate is cosmetic) |
| Admin digest | daily | `dailyRevenue`/`atRiskDigest` emails, gated by `PlatformSettings.notifications` |

Redis is optional for local dev in the sense that the app still boots without
it, but job-dependent features (reminders, digests) won't run.

## 6. External integrations and their degrade paths

Every external integration is optional at boot — `apps/api/src/config/env.ts`
validates env at startup and only `DATABASE_URL`/`JWT_ACCESS_SECRET` are
required. Everything else degrades gracefully rather than failing to boot:

| Integration | Env vars | Unconfigured behavior |
|---|---|---|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout falls back to a dev-only simulate path; production throws if neither gateway is configured |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Same as Stripe |
| Cloudflare Stream | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_TOKEN`, `CLOUDFLARE_STREAM_KEY_ID`, `CLOUDFLARE_STREAM_KEY_PEM` | Video upload/playback endpoints 503 |
| Resend (email) | `RESEND_API_KEY` | `EmailService` logs to console instead of sending |
| Twilio (SMS) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | `SmsService` logs instead of sending |
| Sentry | `SENTRY_DSN` | No error tracking, no functional impact |
| Redis | `REDIS_URL` | Background jobs don't run; rest of the API still works |

The Cloudflare Stream key pair enables **local playback-token signing** — HLS
URLs are signed in-process instead of one Cloudflare API call per lesson play.

## 7. Observability & error handling

- **Logging**: `nestjs-pino`, pretty-printed in dev, structured JSON in
  production, with `cookie`/`authorization` headers redacted.
- **Errors**: `AllExceptionsFilter` normalizes every thrown error to
  `{ error: string, message: string | string[] }`; validation failures are
  `400 ValidationError` with per-field messages.
- **Audit trail**: `AuditInterceptor` writes an `AuditLog` row per mutating
  request — actor, action, entity, entity id, metadata.
- **Rate limiting**: global `ThrottlerGuard` (120/min), tightened per-route on
  sensitive auth endpoints and public-by-serial certificate lookups.

## 8. Frontend architecture notes

- **Data fetching**: TanStack Query wraps a single typed `lib/api` fetch client
  — no ad hoc `fetch()` calls scattered through components. Every portal
  (storefront, student, instructor, admin, org, sales-agent) is wired to the
  real API; there is no mock-data path left in the shipped app (`lib/mock/*`
  exists as reference fixtures only and is not imported anywhere — see the note
  in the root `README.md`).
- **Auth on the client**: httpOnly cookies carry the actual session; `proxy.ts`
  is UX routing only (§3), never a security boundary.
- **Cart**: entirely client-side (`lib/context/store.tsx`) — an array of course
  IDs, nothing persisted server-side until checkout.
- **Referral capture**: a `?ref=CODE` query param is captured client-side into
  `localStorage` and survives navigation to checkout (`FEATURE_FLOWS.md` §2.2).

## 9. Monorepo & tooling

- **Turborepo + pnpm workspaces** orchestrate `apps/{web,api}` and
  `packages/{shared,config}`; `turbo.json` defines the task graph (`dev`,
  `build`, `lint`, `typecheck`, `test`) with `packages/shared` built before
  anything that imports it.
- **`packages/config`** centralizes `tsconfig`/eslint/prettier bases so both
  apps stay on the same TypeScript strictness and lint rules.
- Local infra is `docker-compose.yml`: Postgres 16 + Redis 7, nothing else —
  there's no object storage service because video lives in Cloudflare Stream
  and every other "file" (avatars, lesson resources) is a URL the operator
  already hosts elsewhere.

See the root [`README.md`](../README.md) for local setup and the feature list,
and [`FEATURE_FLOWS.md`](./FEATURE_FLOWS.md) for the step-by-step behavior of
every role and feature.
