# Notification System — Implementation Plan

**Author:** Sarwar · **Date:** 2026-08-22 · **Status:** Phases 1 & 2 implemented and verified (2026-08-23)

## Goal

SkillStream has real notification infrastructure — a BullMQ-backed reminder worker
(`apps/api/src/modules/jobs/`), Resend-backed email delivery, and per-user opt-in
preferences — but it only covers students, only pushes outward (email/SMS), and has
**no in-app inbox for any role**. Instructors, sales agents, and org admins get zero
notification coverage today, even at moments with a clear trigger already in the code
(application approved/rejected, payout state changes, referral confirmed).

Build one first-party `Notification` record and a small in-app bell/inbox that every
backend action writes to directly, in the same transaction as the action it describes.
Email (and later SMS) become optional amplifiers of that same event, reusing the
BullMQ queue and Resend integration already built for reminders — not a second
parallel system, and not a third-party notification vendor (Novu/Courier/OneSignal/
Knock etc.).

---

## Constraints & decisions

- **Vendor scope**: "no third party" applies to the notification system itself — the
  `Notification` table, the bell/inbox, the delivery worker are all in-house. Resend
  stays as the email transport layer, unchanged from what's already running today
  (password resets, reminder emails). Self-hosting mail transport is a separate,
  much larger project and was never in scope here.
- **Product scope**: in-app bell/inbox only. No browser/OS push notifications — a
  user only sees something when they actually have SkillStream open. No push
  permissions, no service worker, no push infrastructure to maintain.
- **SMS**: not built now, but the schema stays SMS-ready by construction (see
  Data model). `NotificationChannel` stays a real enum (`IN_APP | EMAIL | SMS`), and
  `NotificationPreference.sms` exists and defaults `false` — unused, not absent.
  Mirrors what `ReminderChannel` / the never-wired `SmsService.send()` already do.
  Enabling SMS later = one delivery adapter + flipping a default, never a migration.
- **Real-time delivery is tiered, not uniform**. Only two events were called out as
  needing to feel instant: **payment confirmation** and **enrollment granted**.
  Everything else (reviews, applications, payouts, engagement nudges) is fine
  delayed. So:
  - Ambient bell: polls `GET /me/notifications/unread-count` every 20–30s. Covers
    every role, every event.
  - The two sensitive events: the checkout success/receipt page polls the order's
    own status endpoint directly (not the notification table) every 1–2s, capped at
    ~30–60s, stopping the instant the order flips `PAID`. Same pattern most payment
    UIs use (incl. Stripe's own hosted checkout redirect) — checks source-of-truth
    order state, not a notification row.
  - No WebSocket server, no SSE, no push service. If a future event outside these two
    needs the same treatment, extend the one-screen fast-poll pattern to it before
    reaching for general-purpose push infra.
- **Retention**: read notifications purge after 90 days, unread after 1 year, via a
  nightly job on the existing BullMQ infra. Same policy extends to `ReminderLog`
  (which currently has no cleanup job at all).
- **Partitioning: start unpartitioned, convert later.** See "Scale & retention"
  below for the full reasoning, monitoring approach, and conversion runbook.
- **Unread count**: denormalized `User.unreadNotificationCount`, updated
  transactionally at write/mark-read time — never a live `COUNT(*)` against the full
  table.
- **Broadcast-shaped events**: see "Scale & retention" below — fan-out-on-write is
  fine everywhere except potentially `NEW_CONTENT`-style broadcasts.
- **Consistency**: the `Notification` insert always happens inside the same DB
  transaction as the state change it describes (order → PAID, application →
  APPROVED, etc.), never as a separate follow-up call. A crash between two calls is
  how you get an order marked PAID with no notification ever created.
- **Admin fan-out fix**: today's four admin alerts (`newEnrollment`, `newReview`,
  `dailyRevenue`, `atRiskDigest`) all go to one hardcoded `PlatformSettings.supportEmail`
  string. New admin-facing ops events (new application, new payout request) route
  through the same per-user `NotificationPreference` table every other role gets —
  multiple admins, independent preferences, not one shared inbox.

---

## Current state (audit)

| Piece | What it does | Where |
|---|---|---|
| Marketing automation | Admin-authored rules (trigger → channel → template), hourly BullMQ sweep, per-rule cooldown, send log | `jobs/automation.service.ts` |
| Reminder triggers | `IDLE`, `LOW_PROGRESS`, `ABANDONED_CART`, `ALMOST_DONE`, `NEW_CONTENT` — student-only | `schema.prisma` — `ReminderTrigger` |
| Delivery channels | Email live via Resend. SMS schema-ready (E.164 phone, opt-in toggle) but no provider wired — logs only | `jobs/notifications.processor.ts` |
| Student preferences | Per-trigger, per-channel opt-in/out on `StudentProfile.notificationPrefs`, enforced at send time | `contracts/notifications.ts` |
| Admin alerts | 4 toggles, all emailing one fixed `supportEmail` | `email/admin-alerts.service.ts` |
| Send audit trail | `ReminderLog` records every send + status (sent/opened/clicked/bounced) | `schema.prisma` — `ReminderLog` |

**Gaps:** no in-app notification surface for any role · instructors/sales
agents/org admins have zero coverage · admin alerts don't scale past one inbox ·
no order-confirmation or certificate-issued notification exists at all today.

---

## Notification taxonomy

`in-app` is the baseline for every event (free once the inbox exists). Email/SMS
added only where the moment justifies reaching someone outside the app.

### Transactional

| Role | Event | Channels | Priority |
|---|---|---|---|
| Student | Order paid / receipt ready | in-app, email | P1 |
| Student | Certificate issued | in-app, email | P1 |
| Student | Refund processed, access removed | in-app, email | P1 |
| Student | Review approved / hidden by moderation | in-app | P2 |
| Any | Password changed / all sessions revoked | in-app, email | P1 |

### Lifecycle

| Role | Event | Channels | Priority |
|---|---|---|---|
| Instructor | Application approved / rejected | in-app, email | P1 |
| Sales Agent | Application approved / rejected | in-app, email | P1 |
| Instructor | Course published / sent back from review | in-app, email | P1 |
| Instructor / Sales Agent | Payout: requested → approved → paid | in-app, email | P1 |
| Org Member | Invite accepted / expired | in-app | P2 |

### Social

| Role | Event | Channels | Priority |
|---|---|---|---|
| Instructor | New review on your course | in-app | P2 |
| Instructor | New enrollment in your course | in-app | P3 |
| Sales Agent | Referral confirmed (order paid) | in-app, email | P1 |
| Student | Someone replies to your comment | in-app | P2 |

### Engagement (existing triggers, generalized)

| Role | Event | Channels | Priority |
|---|---|---|---|
| Student | Idle 7d / stalled progress / near completion / new content | in-app, email, sms (later) | P2 |
| Student | Abandoned cart (pending order, 3h+) | in-app, email | P2 |
| Org Admin | Seats nearing / at capacity | in-app, email | P2 |

### Ops (admin)

| Role | Event | Channels | Priority |
|---|---|---|---|
| Admin | New instructor / sales-agent application to review | in-app, email | P1 |
| Admin | New payout request to review | in-app, email | P1 |
| Admin | New enrollment / new review (existing) | in-app, email | P3 |
| Admin | Daily revenue / at-risk digest (existing) | in-app, email | P3 |

---

## Data model

```prisma
model Notification {
  id         String   @id @default(cuid())
  userId     String                          // recipient
  event      NotificationEvent               // e.g. PAYOUT_APPROVED, REVIEW_RECEIVED
  title      String
  body       String
  href       String?                         // deep link, e.g. /dashboard/billing
  readAt     DateTime?
  createdAt  DateTime @default(now())

  @@index([userId, readAt])
}
// Plain table at launch — no PARTITION BY. See "Scale & retention" for when and
// how this converts to a partitioned table.

model NotificationPreference {
  userId     String
  event      NotificationEvent
  inApp      Boolean @default(true)          // in-app is opt-out, not opt-in
  email      Boolean @default(true)
  sms        Boolean @default(false)         // unused today, present for later

  @@id([userId, event])
}
```

`ReminderLog` stays as-is — it's the delivery audit trail for the email/SMS fan-out,
not the in-app record. `Notification` is the new source of truth for "what does this
user see when they open the bell," independent of whether an email ever went out.

Supporting indexes/columns:
```sql
CREATE INDEX ON "Notification" (userId, createdAt DESC) WHERE "readAt" IS NULL;
-- User.unreadNotificationCount Int @default(0) — denormalized, updated
-- transactionally at write/mark-read time instead of a live COUNT(*).
```

---

## Scale & retention

Two different operations get confused under "partitioning" — worth being explicit
about which one is manual and which one is automated, since they have opposite
answers.

**Start unpartitioned.** Prisma 6.2.1 has no declarative partitioning support in
`schema.prisma` — getting a partitioned table means hand-editing the generated
migration SQL, and Postgres then requires the primary key to include the partition
column (`PRIMARY KEY (id, createdAt)`, not just `id`), which drifts from what
`schema.prisma` declares. That's a real, permanent maintenance cost for headroom
this platform doesn't need on day one. Ship `Notification` as a plain table — normal
Prisma workflow, normal PR review, nothing special.

**Monitor for the trigger point, automatically.** A nightly BullMQ job (same
infra as the retention purge) checks table size:
```sql
SELECT pg_size_pretty(pg_total_relation_size('"Notification"')) AS size,
       (SELECT reltuples FROM pg_class WHERE relname = 'Notification') AS approx_rows;
```
The real signal isn't a row-count milestone for its own sake — it's the **nightly
retention `DELETE` starting to take noticeably longer or holding locks long enough
to cause contention**. Row count (roughly 5–10M rows, or a few GB) is just an early
proxy that gives a heads-up before that actually happens. When it fires, route the
alert through the notification system itself (an ops event to platform admins) —
no separate monitoring tool needed.

**The conversion itself is a one-time, manually reviewed migration — never a cron
job.** Expand/contract, the same pattern GitHub (`gh-ost`) and Stripe-style
engineering orgs use for any migration that moves real production data:
1. **Expand** — create `Notification_new`, same columns, composite key
   (`id`, `createdAt`), `PARTITION BY RANGE (createdAt)`.
2. **Backfill** — copy rows across in date-range batches during low traffic.
3. **Contract** — rename `Notification` → `Notification_old`,
   `Notification_new` → `Notification`, in one transaction. Prisma needs no schema
   change for this — it queries by table name; Postgres routes to the right
   partition underneath.
4. Keep `Notification_old` untouched for a safety window. Rollback = repoint back
   to it — nothing destructive has happened yet, so "rollback" is never "undo a
   DELETE."
5. Drop `Notification_old` only after the new table is proven under real traffic.

This runs once, executed live by a human during a low-traffic window with
monitoring open — not scheduled, not unattended. A PR carrying this kind of change
should include the runbook above (steps, environment order, rollback trigger), not
just the migration SQL.

**After conversion, routine partition housekeeping IS fully automated.** Creating
next month's partition ahead of time, and dropping fully-expired ones per the
retention policy, are purely additive/subtractive — no live data at risk either
way — so this is handed to
[`pg_partman`](https://github.com/pgpartman/pg_partman), the standard Postgres
extension for exactly this: it pre-creates a configurable number of future
partitions and enforces retention by dropping/detaching expired ones, running via
its own background worker or `pg_cron`. No monthly PR, no reviewer, no human in
the loop — that ongoing maintenance only starts existing once the one-time
conversion above has already happened.

**Reference point, not a target**: OneSignal delivers ~5B notifications/day via
Kafka + a custom delivery engine, not a single partitioned Postgres table — that
tier needs horizontal, distributed storage (the same jump Discord made:
MongoDB → Cassandra → ScyllaDB as messages grew). Postgres partitioning comfortably
covers "a few million rows hurting" up to "hundreds of millions, fine" — well above
any ceiling this platform will reach. If this project ever approaches OneSignal's
tier, the conversation is a different one entirely, not "add another partition."

**Broadcast-shaped events** (e.g. `NEW_CONTENT` to every enrolled student in a
popular course) are the other place row count could jump — fan-out-on-write writes
one row per recipient. Not a problem at current scale; if it becomes one, switch
that specific event to fan-out-on-read (one `BroadcastEvent` row + a live join
against `Enrollment` at read time — the same pattern Twitter/X uses for celebrity
accounts) rather than converting the whole table's write pattern.

---

## Rollout

### Phase 1 — the inbox exists
- `Notification` table (plain, indexed as above — unpartitioned, see Scale &
  retention) + `GET/PATCH /me/notifications` (list, mark read, unread count)
- Bell icon + dropdown + "view all" page in the web shell, shared across all five
  authenticated layouts, polling every 20–30s
- Wire P1 events: order paid, certificate issued, application decisions, payout
  transitions, referral confirmed — each write inside the same transaction as the
  state change it describes
- Fast-poll order status on the checkout success/receipt page specifically

### Phase 2 — email catches up ✅ done (2026-08-23)
- Extended `NotificationsProcessor`'s trigger set to `string`, covering both
  `ReminderTrigger` and `NotificationEvent` — one worker, one preference check,
  for reminders and Phase 1's transactional events alike
- `NotificationPreference` table replaces `StudentProfile.notificationPrefs`
  (data backfilled, zero loss); `/me/notification-preferences` keeps its exact
  API shape, only the storage moved
- `NotificationsService.notify()` now enqueues an email fan-out via the same
  BullMQ queue reminders use — but only when called outside a transaction, or
  via the new `notifyEmailAfterCommit()` once the caller's own transaction has
  resolved (enqueuing inside an open transaction risked a send racing ahead of,
  or surviving, a rollback — see `orders.service.ts`/`instructor.service.ts`/
  `payouts.service.ts` for the pattern)
- Admin-alert fan-out fixed: real `User` rows where `role: ADMIN`, each with
  their own opt-in via `NotificationPreference`, layered under the existing
  platform-wide toggle (which stays as the kill switch)
- Verified live: a real purchase produced an in-app `Notification` row, a
  queued `EMAIL` job, a `ReminderLog` entry, and the dev-mode email log line —
  full pipeline, not just unit-level

### Phase 3 — social & ambient
- Social events (new review, comment reply, new enrollment) — in-app only, no email
  by default
- Org-admin seat/invite events
- Nightly retention job (90d read / 1y unread), same policy applied to `ReminderLog`
- Nightly table-size/row-count check (feeds the future partitioning decision — see
  Scale & retention)
- Revisit real-time delivery only if a new event outside the two P0 ones needs it —
  extend the one-screen fast-poll pattern before reaching for push infra

---

## Decisions log

| Date | Decision | By |
|---|---|---|
| 2026-08-22 | No third-party notification vendor; Resend kept for email transport | Sarwar |
| 2026-08-22 | In-app bell/inbox only, no browser/OS push | Sarwar |
| 2026-08-22 | SMS not built now; schema kept SMS-ready | Sarwar |
| 2026-08-22 | Real-time delivery tiered (slow poll + one-screen fast poll), no WebSocket/SSE | Sarwar |
| 2026-08-22 | Retention: 90d read / 1y unread via nightly job | Sarwar |
| 2026-08-22 | Start unpartitioned; convert via a one-time reviewed runbook only when the nightly size/retention-job alert fires; `pg_partman` automates all routine partition maintenance after that conversion | Sarwar |

Full narrative version with user-journey walkthroughs and the line-by-line plan
review that led to these decisions: see the published artifacts from this session
("The Signal Room" and "The Review Thread").
