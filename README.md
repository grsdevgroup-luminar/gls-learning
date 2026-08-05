# SkillStream — Course Platform

A full course-selling platform: a student-facing **storefront**, a complete **student
learning portal**, an **instructor** program, a **B2B organizations** (seat-based)
program, a worldwide **sales agent / referral** program, and an **admin** panel — backed
by a real NestJS API, PostgreSQL, and Redis-backed background jobs.

> This started as a static Next.js prototype with mocked data. The backend and frontend
> below are both real and production-shaped — see [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md)
> for architecture and data model, and [`docs/FEATURE_FLOWS.md`](docs/FEATURE_FLOWS.md) for
> a step-by-step walkthrough of every role and feature.

## Tech stack

| Layer | Tech | Used for |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | `apps/{web,api}`, `packages/{shared,config}` build/dev orchestration |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript | Storefront, student, instructor, admin, org, sales-agent UIs |
| Frontend UI | Tailwind CSS v4, shadcn/ui on Base UI, framer-motion, lucide-react, Recharts, sonner, next-themes | Styling, animation, charts, toasts, dark mode |
| Frontend data | TanStack Query + a typed `lib/api` fetch client | Server state, caching, mutations against the NestJS API |
| Backend | NestJS 11 + TypeScript | REST API, DI, guards/pipes/interceptors, Swagger |
| Database | PostgreSQL 16 + Prisma 6 | 40-model schema, money as integer cents, `$transaction` for atomic writes |
| Auth | `@nestjs/jwt` + `passport-jwt` + argon2id | Access + rotating single-use refresh tokens in httpOnly cookies, RBAC |
| Validation | Zod (shared schemas in `packages/shared`) | One schema → runtime validation + static types on both API and web |
| Jobs/queues | Redis + BullMQ (`@nestjs/bullmq`) | Hourly maintenance rollup, engagement-reminder queue |
| Video | Cloudflare Stream | Direct-creator-upload + signed HLS/iframe playback (no separate object storage) |
| Payments | Stripe + PayPal (REST) | Checkout sessions, webhook-verified idempotent order fulfillment |
| Email | Resend | Welcome + password-reset transactional email (logs to console if unset) |
| SMS | Twilio | Marketing-automation reminders where the rule's channel is SMS (logs instead of sending if unset) |
| Observability | pino with an application-owned Nest logger adapter, Sentry (optional), global exception filter, audit log interceptor | Structured logs with secret redaction, error tracking, uniform error contract, mutation audit trail |
| Rate limiting | `@nestjs/throttler` | Global request throttling |

## Monorepo layout

```
apps/
  web/                 Next.js app — storefront, student, instructor, admin, org, sales-agent
  api/                 NestJS app — all domain modules + Prisma schema/migrations
packages/
  shared/              Enums, Zod contracts/DTOs, and pure business logic (money, pricing,
                       coupons, progress) shared by both api and web
  config/              Shared tsconfig/eslint/prettier
docker-compose.yml     Local Postgres + Redis
```

## Features by role

### Storefront (public)
- Landing page, course catalog (search/filter/sort/paginate), course detail pages
- Cart, coupon codes, regional (PPP-style) pricing, checkout (Stripe + PayPal)
- Register/login/forgot-password/reset-password
- Instructor application landing page (`/teach`)

### Student
- Dashboard of enrollments, per-course progress, streaks
- Protected lesson player (video via signed Cloudflare Stream playback, articles, quizzes)
- Server-graded quizzes (correct answers never reach the client until after grading)
- Certificates on 100% course completion
- Billing/order history, account/profile settings

### Instructor
- Application → admin-approval workflow (`InstructorProfile.status`)
- Course/section/lesson authoring with reorder, video upload flow, quiz builder
- Course status workflow (draft → review → published)
- Earnings dashboard

### Admin
- Platform overview (KPIs, charts)
- Course, student, order (+ refund), review-moderation, coupon, and pricing-tier management
- Instructor-application queue (approve/reject)
- Marketing automation: rule builder (idle / low-progress / abandoned-cart / almost-done /
  new-content triggers) + reminder send log
- Sales-agent and B2B-organization management

### B2B Organizations (`/org/[slug]`)
- Seat-based access to private, org-only courses
- Member invite/claim flow, seat usage, per-org course assignment
- Org admin portal + platform-admin management screens

### Sales Agents (`/sales-agent`)
- Unique referral code/link; commission attributed on referred orders
- Referral list, earnings ledger (pending/confirmed/paid), payout action (admin side)

## Frontend data status

Every portal (storefront, student, instructor, admin, org, sales-agent) is wired to
the real API — there is no mock-data path left in the shipped app. `apps/web/lib/mock/*`
still exists as reference fixtures (shapes used by early prototyping) but nothing in
`apps/web/app` or `apps/web/components` imports from it anymore; it's safe to delete
once no one needs it as a reference.

## Local setup

Prerequisites: Node ≥ 20, pnpm, Docker (for Postgres/Redis).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # fill in secrets (see table above)
cp apps/web/.env.example apps/web/.env.local

pnpm infra:up                # Postgres :5432 + Redis :6379 via docker-compose
pnpm db:migrate               # apply Prisma migrations
pnpm db:seed                  # seed admin user, pricing tiers, demo data

pnpm dev                      # api on :4000 (/api prefix, Swagger at /docs), web on :3001
```

Everything except `DATABASE_URL`/`JWT_ACCESS_SECRET` is optional for local dev — unset
integrations (Stripe, PayPal, Cloudflare Stream, Resend, Twilio, Sentry) degrade
gracefully (dev-only simulate paths, console-logged emails/SMS, `503` on the specific
feature) rather than failing to boot. See `apps/api/src/config/env.ts` for the full
validated env schema, and [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) §6 for what
each external service is for, and its exact degrade behavior when unset.

### API logs

Development writes readable logs to the console and structured JSON Lines to
`apps/api/logs/logger-YYYY-MM-DD.log` by default. Files older than 14 UTC days
are removed automatically.

```bash
# Search message text
rg 'payment failed' apps/api/logs/

# Filter errors with jq
jq -c 'select(.level >= 50)' apps/api/logs/logger-$(date -u +%F).log
```

Production uses `LOG_DESTINATION=stdout` and does not create log files. Future
centralized destinations are added behind the logging destination factory.

Configure API logging with `LOG_DESTINATION` (`file` or `stdout`), `LOG_LEVEL`
(`fatal`, `error`, `warn`, `info`, `debug`, or `trace`), `LOG_DIR`, and
`LOG_RETENTION_DAYS`. Development defaults to `file`, while production defaults
to and requires `stdout`; `LOG_DIR` and `LOG_RETENTION_DAYS` only apply to the
file destination.

## Scripts

```bash
pnpm dev / build / lint / typecheck / test   # turbo-orchestrated across all packages
pnpm db:generate / db:migrate / db:seed / db:studio
pnpm infra:up / infra:down                   # docker-compose for Postgres + Redis
```
