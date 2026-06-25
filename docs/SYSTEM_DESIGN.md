# SkillStream — System Design

> Production architecture for the SkillStream course platform: a NestJS backend
> that owns all data, auth, payments, and media, with the existing Next.js 16
> frontend rewired from its localStorage prototype store onto the real API.

---

## 1. Where we came from / where we're going

**Prototype (the starting point):** Next.js 16 App Router, ~63 components, four role
surfaces (storefront, student, instructor, admin). **All data was mocked** in
`lib/mock/*` and held in a client-side React Context persisted to `localStorage`
(`lib/context/store.tsx`). No server, no DB, no real auth, no payments, no video,
no cross-device persistence.

**Target:** a production system where a **NestJS backend is the single source of
truth** for data, business logic, auth, payments, and media. The Next.js UI is
**reused as-is** — only its data layer changes (local store → API calls).

The prototype's `types/index.ts` and the 60+ methods in `lib/context/store.tsx`
are the de-facto spec: the backend must cover every store method, and the Prisma
schema mirrors and normalizes every type.

### Locked stack decisions

| Concern | Decision |
|---|---|
| **Auth** | Self-hosted JWT in NestJS — access + rotating refresh, httpOnly cookies, argon2id, RBAC |
| **Video** | Cloudflare Stream (signed playback) |
| **Hosting** | Vercel (web) + Railway/Render (API, Postgres, Redis); Cloudflare for media/CDN |
| **Repo** | Turborepo + pnpm monorepo with a shared package |
| **ORM / DB** | Prisma + PostgreSQL (money stored as integer cents) |
| **Payments** | Stripe + PayPal (one-time course purchases) |
| **Rollout** | Build the complete backend, then rewire the Next.js frontend domain-by-domain |

---

## 2. Target architecture

```
                    ┌─────────────────────────────────────────┐
   Browser  ─────►  │  Next.js 16 (Vercel)                     │
                    │  - RSC fetches via server-side API client│
                    │  - Client mutations via typed fetch hooks│
                    │  - httpOnly cookie carries JWT           │
                    └───────────────┬─────────────────────────┘
                                    │ HTTPS (REST/JSON, OpenAPI)
                    ┌───────────────▼─────────────────────────┐
                    │  NestJS API (Railway/Render)             │
                    │  Modules: auth, users, courses,          │
                    │  enrollment, progress, quiz, reviews,    │
                    │  catalog, cart, orders, payments,        │
                    │  coupons, pricing, instructors, admin,   │
                    │  marketing, media, notifications         │
                    │  Cross-cutting: RBAC guards, validation, │
                    │  interceptors, BullMQ producers          │
                    └──┬──────────┬──────────┬──────────┬──────┘
                       │          │          │          │
             ┌─────────▼──┐  ┌────▼────┐ ┌───▼─────┐ ┌──▼────────────┐
             │ PostgreSQL │  │  Redis  │ │ Cloudfl.│ │ Stripe/PayPal │
             │  (Prisma)  │  │(cache + │ │ Stream  │ │  Resend/Twilio│
             │            │  │ BullMQ) │ │ (video) │ │  (webhooks)   │
             └────────────┘  └─────────┘ └─────────┘ └───────────────┘
                                  ▲
                       ┌──────────┴───────────┐
                       │ BullMQ workers        │
                       │ (same Nest codebase): │
                       │  emails, reminders,   │
                       │  analytics rollups,   │
                       │  webhook retries      │
                       └───────────────────────┘
```

### Monorepo layout (Turborepo + pnpm)

```
course-platform/
├─ apps/
│  ├─ web/                 # existing Next.js app, moved here mostly as-is
│  └─ api/                 # NestJS application
├─ packages/
│  ├─ shared/              # source of truth: domain types, enums, Zod schemas,
│  │                       # DTO contracts, currency/pricing/coupon pure functions
│  ├─ config/              # shared tsconfig / eslint / prettier
│  └─ api-client/          # generated typed client (OpenAPI → TS) consumed by web
├─ docker-compose.yml      # local Postgres + Redis
├─ turbo.json
└─ package.json (pnpm workspaces)
```

**Key principle:** the pure business helpers that already exist on the frontend
(coupon validation, regional pricing, progress math) live in `packages/shared`, so
**both** the backend (authoritative) and frontend (optimistic UI/preview) run the
*identical* logic.

---

## 3. Data model (Prisma — 28 models)

Normalizes the prototype types. Money is **integer cents**, not floats. IDs are
`cuid()`. Denormalized counters (rating, studentCount, revenue, used) are maintained
by services/jobs — **never trusted from clients**.

**Identity & roles**
- `User` — email (unique), passwordHash, name, avatar, country, role
  (`STUDENT|INSTRUCTOR|ADMIN`), emailVerified. Single user table; role-specific data
  lives in profile tables.
- `RefreshToken` — tokenHash, expiresAt, revokedAt, userAgent/ip (rotation + reuse detection).
- `InstructorProfile` — title, bio, expertise, ratingAvg, studentCount, courseCount,
  status (`PENDING|APPROVED|REJECTED`), earningsCents.
- `InstructorApplication` — name, email, expertise, headline, bio, sampleUrl, status, review fields.
- `StudentProfile` — streakDays, status (`ACTIVE|IDLE|AT_RISK`), totalSpentCents, notificationPrefs.

**Catalog**
- `Course` — slug (unique), title, subtitle, description, category, level, thumbnail,
  instructorId, basePriceCents, originalPriceCents?, language, status
  (`DRAFT|REVIEW|PUBLISHED`), bestseller, whatYouLearn[], requirements[], ratingAvg,
  reviewCount, studentCount, revenueCents, timestamps.
- `Section` — courseId, title, order.
- `Lesson` — sectionId, title, durationSec, type (`VIDEO|QUIZ|ARTICLE`), preview, order,
  articleContent?, resources (Json[]), `cfVideoUid?` (Cloudflare Stream UID).
- `Quiz` → `QuizQuestion` → `QuizOption` (with `isCorrect` flag). Correctness is
  **never serialized to students** (see §5).

**Learning**
- `Enrollment` — userId × courseId (unique), enrolledAt, completedAt?, minutesWatched,
  lastActivityAt, status (`IN_PROGRESS|COMPLETED|ABANDONED`).
- `LessonProgress` — enrollmentId × lessonId (unique), completed, completedAt.
  (Replaces the prototype's `progress: Record<courseId, lessonId[]>` map.)
- `QuizAttempt` (per-attempt audit) + `QuizResult` (rolled-up: bestScore, lastScore,
  attempts, passed).
- `Certificate` — enrollmentId, serial (unique), issuedAt, pdfUrl. Issued at 100%.

**Engagement**
- `Review` — courseId × userId (unique → one review per course), rating, title, body,
  status (`PENDING|APPROVED|HIDDEN`), helpful.

**Commerce**
- `Order` — userId, country, subtotalCents, discountCents, totalCents, currency,
  couponCode?, gateway (`STRIPE|PAYPAL`), status (`PENDING|PAID|REFUNDED|FAILED`),
  providerPaymentId, providerRef, timestamps. Cart stays client-side; **prices/coupons
  are recomputed server-side at order creation.**
- `OrderItem` — orderId, courseId, titleSnapshot, priceCents.
- `Coupon` — code (unique), type (`PERCENT|FIXED|FREE`), value, minSpendCents?, scope
  (`GLOBAL|COURSE`), courseId?, expiresAt, usageLimit, used, active.
- `CouponRedemption` — couponId × orderId × userId (enforces usage limits atomically).

**Pricing / localization**
- `PricingTier` — name, multiplier, countries[].
- `CountryOverride` — country, flag, type, tierId?, flatPercent.
- `Region` — code, country, flag, currency, symbol, fxRate (refreshed by a job).

**Marketing / automation**
- `AutomationRule` — name, trigger (`IDLE|LOW_PROGRESS|ABANDONED_CART|ALMOST_DONE|NEW_CONTENT`),
  condition, channels[], template, active, sentCount.
- `ReminderLog` — userId, ruleId?, channel (`EMAIL|SMS`), trigger, subject, status, createdAt.

**Ops**
- `AuditLog` — actorUserId, action, entity, entityId, metadata, createdAt.
- `WebhookEvent` — provider, eventId (unique), payload, processedAt (idempotency for Stripe/PayPal).

---

## 4. NestJS module map → replaces store methods

Each store method in `lib/context/store.tsx` maps to an endpoint:

| Domain | Endpoints | Replaces store method(s) |
|---|---|---|
| **auth** | `POST /auth/register \| /login \| /refresh \| /logout`, `GET /auth/me` | `login`, `loginAs`, `logout`, `currentInstructor` |
| **catalog** | `GET /courses` (filter/sort/search/paginate), `GET /courses/:slug`, `/courses/:id` | `courses`, `getCourse` |
| **authoring** | `POST/PATCH /courses`, `DELETE /courses/:id`, `PATCH /courses/:id/status`, section/lesson CRUD + reorder | `upsertCourse`, `deleteCourse`, `setCourseStatus` |
| **cart/checkout** | `POST /checkout/quote` (server price+coupon calc), `POST /checkout/session` | `addToCart`, `setCoupon`, pricing/coupon preview |
| **payments** | `POST /webhooks/stripe \| /webhooks/paypal` | `enroll` (the real, trusted enrollment) |
| **enrollment/progress** | `GET /me/enrollments`, `POST /enrollments/:courseId/lessons/:lessonId/toggle`, `GET /me/progress` | `isEnrolled`, `enroll`, `toggleLesson`, `isLessonDone`, `completedCount` |
| **quiz** | `GET /lessons/:id/quiz` (no answers), `POST /lessons/:id/quiz/attempt` (server-graded) | `getQuizResult`, `submitQuizAttempt` |
| **reviews** | `GET/POST /courses/:id/reviews`, admin `PATCH /reviews/:id/status` | `getMyReview`, `submitReview` |
| **instructors** | `POST /instructors/apply`, `GET/PATCH /me/instructor`, admin approve/reject | `applyAsInstructor`, `updateInstructorProfile`, `approveInstructor`, `rejectInstructor`, `myCourses` |
| **pricing** | `GET /pricing/regions`, admin tier/override CRUD, `GET /pricing/quote` | `region`, `setRegionCode`, regional price calc |
| **admin** | orders, students, instructor queue, coupons CRUD, analytics KPIs | admin pages' mock reads |
| **marketing** | automation rule CRUD, reminder logs | `lib/mock/automation.ts` |
| **media** | `POST /media/upload-url` (Cloudflare direct-creator-upload), `GET /lessons/:id/playback` (signed token) | `video-upload.tsx`, learn player |

**Cross-cutting:** global Zod `ValidationPipe` (`nestjs-zod`, schemas from
`packages/shared`), `JwtAuthGuard` + `RolesGuard` (`@Roles('ADMIN')`),
`@CurrentUser()` decorator, serialization interceptor, RFC-7807 exception filter,
`@nestjs/throttler` rate limiting (auth + checkout), pino logging with request IDs,
Swagger/OpenAPI at `/docs` → feeds `packages/api-client` codegen.

---

## 5. Critical security / correctness rules

These are the things the prototype gets "wrong" because it's a demo:

1. **Quiz answers are server-side only.** `isCorrect` never reaches a student client.
   `GET /lessons/:id/quiz` returns questions/options without correctness; grading
   happens in `POST .../attempt`.
2. **Enrollment only via paid order or free course.** Created **only** by a verified
   payment webhook (idempotent on `WebhookEvent.eventId`) or a `price=0` checkout.
   Never trust a client "I'm enrolled."
3. **Prices & coupons recomputed server-side** at `/checkout/quote` and again at order
   creation. Client-sent prices are ignored. Coupon usage decremented atomically via
   the `CouponRedemption` unique constraint to prevent oversell/race.
4. **Video access is gated.** `GET /lessons/:id/playback` checks enrollment (or
   `lesson.preview`), then returns a short-lived Cloudflare Stream signed token. No
   raw video URLs in DB responses.
5. **RBAC on every mutation.** Instructors edit only their own courses
   (`course.instructorId === user.id`); admin override. Status transitions validated
   (draft → review → published).
6. **Auth hardening:** argon2id hashing, access token ~15m (memory), refresh ~7d
   (httpOnly+Secure+SameSite cookie) with rotation + reuse detection, email verify +
   password reset via Resend, throttled login.

---

## 6. Background jobs (BullMQ on Redis)

- **Payment reconciliation / webhook retry** — keep enrollment + order consistent.
- **Certificate generation** — render PDF at 100% completion, upload, store URL.
- **Engagement automations** — scheduled scans for `idle / low_progress / almost_done /
  abandoned_cart / new_content` → enqueue email/SMS → write `ReminderLog`. Drives `/admin/marketing`.
- **Analytics rollups** — nightly aggregation into summary tables so `/admin` KPIs are
  fast reads, not live `COUNT(*)` scans.
- **FX refresh** — periodic `Region.fxRate` update.
- **Search index** (later) — Postgres full-text first; Meilisearch/Typesense if needed.

---

## 7. Frontend integration (reuse the existing Next.js)

The visual layer stays; the data layer is replaced:

1. **Move** the app into `apps/web`; extract domain types/enums into `packages/shared`
   and re-export so existing imports barely change.
2. **Replace `StoreProvider`** (`lib/context/store.tsx`) with:
   - **Server Components** fetch through a server-side API client reading the JWT from
     the httpOnly cookie — existing loaders (`course-detail-loader.tsx`,
     `learn-loader.tsx`) become real fetches.
   - **Client mutations** (cart, toggle lesson, quiz/review, course builder) → TanStack
     Query `useMutation`/`useQuery` with optimistic updates.
   - Cart + region selection stay lightweight client state, but **never** authoritative
     for money or access.
3. **Auth in Next.js:** login/signup call `/auth/*`; tokens land in httpOnly cookies.
   Middleware guards `/(student)`, `/admin`, `/instructor` by verifying the session
   server-side instead of reading `role` from localStorage.
4. **Read the bundled Next docs first.** Per `AGENTS.md`, this is a customized Next.js 16;
   before writing data-fetching/middleware/route-handler/server-action code, read the
   relevant guide under `apps/web/node_modules/next/dist/docs/`.

---

## 8. Build order (backend-complete, frontend rewired per domain)

1. **Foundation** — monorepo, scaffold `apps/api` + `packages/{shared,config}`, Prisma
   schema + first migration, Docker Compose, CI.
2. **Auth + users** — register/login/refresh/logout, RBAC, email verify/reset; seed admin.
   Rewire Next.js auth + middleware.
3. **Seed migration** — port `lib/mock/*` into a Prisma seed so data matches today.
4. **Catalog (read)** — `/courses` + detail with filter/sort/search/pagination; rewire storefront.
5. **Enrollment + progress + quiz** — server-graded quizzes, lesson toggle; rewire learn player.
6. **Commerce** — checkout quote, Stripe + PayPal sessions, webhooks → enrollment, coupons, orders.
7. **Media** — Cloudflare Stream upload URLs + signed playback.
8. **Authoring** — course/section/lesson CRUD + reorder, status workflow.
9. **Reviews + instructor program** — moderation, applications, approval.
10. **Admin + marketing + analytics** — admin CRUD, automation engine, KPI rollups.
11. **Hardening** — rate limits, audit logs, observability (Sentry + pino + uptime),
    backups/PITR, load test, security review.

---

## 9. Verification strategy

- **API:** Jest unit tests for pricing/coupon/quiz-grading; e2e (supertest + Postgres
  test container) for auth, checkout→webhook→enrollment, RBAC denials, coupon
  race/oversell. Stripe CLI / PayPal sandbox for webhook replays.
- **Data parity:** after seed, every `/admin` KPI and course list matches the prototype.
- **Security checks:** quiz endpoint returns no answer flags; non-owner instructor edit
  → 403; unpaid playback → 403; reused refresh token → revoked.
- **E2E (web):** register → browse → buy (sandbox) → enrolled → watch (signed video) →
  complete lesson → quiz pass → certificate; instructor apply → admin approve → publish.
- **Load:** k6 on `/courses` and `/checkout/quote`; confirm rollup tables keep `/admin` fast.

---

## 10. Current status (branch `feat/production-backend`)

**Done & verified:**
- Monorepo scaffold (Turborepo + pnpm; `apps/{web,api}`, `packages/{shared,config}`).
- `packages/shared` — enums, money, pricing, coupon, progress helpers (`quizPassed`,
  etc.) + Zod contracts and DTO types; vitest passing.
- `apps/api` (NestJS) — Prisma with the **full 28-model schema migrated** (`init`);
  globally-registered `JwtAuthGuard` + `RolesGuard` + `ThrottlerGuard` + exception
  filter; pino logging with header redaction; Swagger at `/docs`; Zod-validated env.
- **Auth fully working** — register / login / refresh / logout / me with httpOnly
  cookies, argon2id hashing, opaque single-use rotating refresh tokens. Seed creates
  admin `admin@skillstream.dev` / `admin12345` + pricing tiers/regions.
- **Catalog read API** — `courses/` module: list with filter/sort/search/pagination
  + course detail, via DTO mappers that strip internal fields.
- **Enrollment + progress** — `enrollment/` module: enroll, lesson completion,
  progress percentage.
- **Quiz (server-graded)** — `quiz/` module: play endpoint strips correctness;
  `submitAttempt` grades server-side, writes `QuizResult` + `QuizAttempt` atomically,
  and marks the lesson complete on pass.

**Local dev workflow:**
```bash
docker compose up -d          # Postgres :5432 + Redis :6379
pnpm --filter @skillstream/api prisma:migrate
pnpm --filter @skillstream/api prisma:seed
pnpm dev                      # api on :4000 (/api prefix), web on :3000
```

**Not started yet:** full mock-catalog seed → commerce (Stripe/PayPal + webhooks) →
media (Cloudflare Stream) → authoring (course/section/lesson CRUD) → reviews/instructor
program → admin/marketing/analytics → hardening (BullMQ jobs, audit logs, observability).
Then rewire the frontend (replace `lib/context/store.tsx` with TanStack Query +
cookie-based SSR fetch).

---

## Appendix A — System design principles in depth

These are the principles the backend is actually built on, each tied to where it
lives in the code.

### A1. Server authority — the client is never trusted

The single most important rule. Anything that affects **money, access, or grades** is
decided on the server; the client may *display* a prediction but can never *assert* a
result.

- **Quiz grading** (`quiz/quiz.service.ts`): `getForPlay()` returns questions and
  options but deliberately omits the `isCorrect` flag — the browser literally never
  receives the answer key. `submitAttempt()` looks up the correct option server-side,
  computes the score, and persists it. Compare this to the prototype, where
  `quiz-player.tsx` knew every answer.
- **Enrollment** (planned commerce phase): created only by a verified payment webhook
  (idempotent on `WebhookEvent.eventId`) or a genuinely free checkout — never by a
  client call.
- **Prices/coupons**: recomputed at checkout from `packages/shared` pricing logic;
  client-sent amounts are ignored.
- **Denormalized counters** (`ratingAvg`, `studentCount`, `revenueCents`) are written
  only by services/jobs, never accepted from a request body.

### A2. One source of truth for contracts (`packages/shared`)

Types, enums, **Zod schemas**, and **pure business functions** live in one package
imported by *both* api and web:

- A Zod schema is used twice: at runtime by `ZodValidationPipe`
  (`common/zod-validation.pipe.ts`) to validate input, and at compile time via
  `z.infer` to produce the TypeScript type (`LoginInput`, `RegisterInput`, …). One
  definition, no drift between validation and types.
- Pure functions (`quizPassed`, money/pricing/coupon/progress math) run identically on
  the authoritative server and on the optimistic-UI client. The frontend can preview a
  coupon discount with the *exact* logic the server will later enforce.
- DTO shapes (`AuthUserDto`, `CourseDetailDto`, `QuizPlayDto`, `Paginated<T>`) are
  declared here, so the API response type and the frontend's expected type are the
  same symbol.

### A3. Layered architecture: Controller → Service → Data

Strict separation of concerns:

- **Controllers** (`auth.controller.ts`, `catalog.controller.ts`) own *HTTP* concerns
  only — reading cookies, setting cookies, status codes, attaching the validation pipe,
  Swagger tags. No business logic.
- **Services** (`auth.service.ts`, `quiz.service.ts`, `courses.service.ts`) own
  business rules and orchestration, and are unit-testable without HTTP.
- **Data access** is `PrismaService`; **mappers** (`courses/course.mapper.ts`) convert
  Prisma rows into DTOs, which is also where internal columns get stripped before they
  ever reach the wire.

### A4. Secure by default (deny, then opt out)

Guards are registered **globally** in `app.module.ts` via `APP_GUARD`, in order:
`JwtAuthGuard` → `RolesGuard` → `ThrottlerGuard`. Consequences:

- Every new endpoint is **authenticated by default**. You must explicitly add
  `@Public()` (`common/decorators.ts`) to expose one (register/login/refresh/logout).
  Forgetting to secure a route is therefore not a failure mode.
- Authorization is declarative: `@Roles('ADMIN')` on a handler; `RolesGuard` reads it
  via the `Reflector` and 403s anyone lacking the role.
- Rate limiting applies everywhere (120 req/60s baseline) without per-route wiring.

### A5. Fail fast on configuration

`config/env.ts` parses **all** environment variables through a Zod schema at boot
(`validateEnv`) and throws a readable, itemized error if anything required is missing or
malformed. The app cannot start misconfigured. Everything downstream reads config
through a typed `ConfigService<Env, true>`, so `config.get("JWT_ACCESS_SECRET")` is
type-checked and guaranteed present.

### A6. Stateless access, stateful refresh (token design)

- **Access token**: a signed JWT, short-lived (`JWT_ACCESS_TTL`, default 15m). Verified
  statelessly by `passport-jwt`; only a single user lookup confirms the account still
  exists (`jwt.strategy.ts`).
- **Refresh token**: an **opaque random 48-byte string**, not a JWT. Only its SHA-256
  **hash** is stored (`token.service.ts`) — a database leak does not expose usable
  tokens. It is **single-use**: `rotateRefreshToken()` deletes the old row and issues a
  new one in the same flow, so a stolen-and-replayed token finds no matching row and is
  rejected. This is the practical core of refresh-token reuse detection.

### A7. Defense in depth on identity

argon2id password hashing; tokens delivered as `httpOnly` + `Secure` (prod) +
`SameSite` cookies so JS can't read them and CSRF surface is reduced; pino is configured
to **redact** `req.headers.cookie` and `req.headers.authorization` so secrets never land
in logs.

### A8. One consistent error contract

`common/all-exceptions.filter.ts` (global `APP_FILTER`) converts *every* thrown
error — Nest `HttpException`, plain `Error`, or unknown — into a uniform body
`{ statusCode, error, message, path, timestamp }`. 5xx errors are logged with a stack;
4xx are not. Clients get a predictable shape to parse; this is the foundation for the
RFC-7807 problem+json target.

### A9. Atomicity & idempotency at the database

- **Transactions**: multi-row writes use `prisma.$transaction` (e.g. quiz writes
  `QuizResult` + `QuizAttempt` together; catalog list runs `findMany` + `count`
  together for a consistent page+total).
- **Upsert** makes repeat quiz submissions idempotent on `(userId, lessonId)`.
- **Unique constraints** enforce invariants the application can't accidentally violate:
  one enrollment per `(userId, courseId)`, one review per `(courseId, userId)`, one
  redemption row per coupon use, one `WebhookEvent.eventId`. The DB is the last line of
  defense against races and double-processing.

### A10. Money as integer cents

All monetary values are integers (cents), never floats — eliminating rounding drift.
Conversion/formatting lives in `packages/shared/money.ts`.

---

## Appendix B — Backend technology stack, in depth

### B1. NestJS 11 (the application framework)

A TypeScript framework built on **dependency injection** and decorators. Mental model:

- **Modules** (`@Module`) group related providers and controllers and define what each
  can see. `AppModule` wires the global pieces; feature modules (`AuthModule`,
  `CoursesModule`, `EnrollmentModule`, `QuizModule`) encapsulate a domain. Note
  `QuizModule` imports `EnrollmentModule` because quiz completion calls
  `EnrollmentService` — modules export the providers other modules may inject.
- **Providers** (`@Injectable` services) are singletons resolved by the DI container.
  A service declares its dependencies in the constructor and Nest supplies them
  (`AuthService` receives `UsersService` + `TokenService`).
- **Controllers** map routes to handlers via decorators (`@Post('login')`,
  `@CurrentUser()`, `@Body(pipe)`).
- **Request lifecycle** (the order things run for one request):
  `cookie-parser` / `pino-http` middleware → **Guards** (JwtAuth → Roles → Throttler)
  → **Pipes** (`ZodValidationPipe` validates/parses the body) → **Controller handler**
  → **Service** → **Prisma** → response. Any thrown error is caught by the global
  **exception filter**. Understanding this order explains *why* auth is checked before
  validation, and why a malformed body on a protected route returns 401 (guard) before
  400 (pipe).
- Bootstrap (`main.ts`): global `/api` prefix, cookie-parser, CORS locked to
  `WEB_ORIGIN` with `credentials: true` (required for cookie auth), Swagger at `/docs`.

### B2. Prisma 6 + PostgreSQL 16 (data layer)

- **Schema-first ORM**: `prisma/schema.prisma` is the source of truth (28 models);
  `prisma migrate` generates SQL migrations and a fully-typed client. Field selection
  (`select` / `include`) narrows both the query and the returned TypeScript type.
- **`PrismaService`** extends `PrismaClient` and implements `OnModuleInit` /
  `OnModuleDestroy` so the connection pool opens/closes with the Nest lifecycle, and is
  injectable like any other provider.
- **`$transaction`** gives ACID guarantees for multi-statement operations; unique
  composite keys (`userId_lessonId`, etc.) back the idempotency rules in A9.
- Postgres provides the relational integrity (FKs), `mode: "insensitive"` search used
  in catalog, and a path to full-text search later.

### B3. Auth stack — Passport + @nestjs/jwt + argon2

- **`@nestjs/jwt`** signs/verifies access tokens; the secret and TTL come from validated
  env.
- **`passport-jwt`** via a `PassportStrategy` (`jwt.strategy.ts`) extracts and verifies
  the token. A **custom extractor** reads the `access_token` httpOnly cookie first and
  falls back to an `Authorization: Bearer` header — so browsers use cookies while API
  clients/tests can use bearer tokens, with one strategy.
- **`argon2`** (argon2id) for password hashing — a memory-hard algorithm resistant to
  GPU cracking.
- **`cookie-parser`** populates `req.cookies`; the controller sets `httpOnly`/`Secure`/
  `SameSite` flags per environment.

### B4. Validation — Zod + a custom pipe

Rather than `class-validator`/DTO classes, the project uses **Zod schemas from
`packages/shared`** with a thin `ZodValidationPipe`. `safeParse` either returns typed
data or throws a `BadRequestException` with a flattened `path: message` list. Same
schema → runtime guard *and* static type (see A2).

### B5. Cross-cutting infrastructure

- **`@nestjs/throttler`** — global rate limiting (`ThrottlerGuard`), tightened on
  auth/checkout later.
- **`nestjs-pino` / `pino-http`** — fast structured JSON logs, `pino-pretty` in dev,
  automatic request logging, secret redaction.
- **`@nestjs/swagger`** — generates OpenAPI from decorators at `/docs`; `addBearerAuth`
  for try-it-out. This spec later feeds `packages/api-client` codegen.
- **`@nestjs/config`** — typed, validated environment access app-wide.

### B6. Build & tooling

- **`nest build`** compiles to `dist/main.js` (a `tsconfig.build.json` excludes
  `prisma/`).
- **`tsx`** runs TypeScript directly — used for `prisma/seed.ts`.
- **`vitest`** for unit tests (shared business logic, services).
- **pnpm workspaces + Turborepo** orchestrate cross-package build order
  (`^build` dependency so `shared`/`config` build before `api`/`web`) and caching.

### B7. Planned additions (later phases)

- **Redis + BullMQ** — job queue/workers for emails, reminders, certificate PDFs,
  analytics rollups, webhook retries, FX refresh (Redis already in `docker-compose.yml`;
  `REDIS_URL` already in the env schema).
- **Stripe + PayPal SDKs** — checkout sessions + webhook verification (`STRIPE_*`,
  `PAYPAL_*` env slots reserved).
- **Cloudflare Stream** — direct-creator-upload + signed playback tokens
  (`CLOUDFLARE_*` reserved).
- **Resend / Twilio** — transactional email + SMS for the automation engine.
