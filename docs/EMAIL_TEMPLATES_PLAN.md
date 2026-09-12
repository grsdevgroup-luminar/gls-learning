# Admin-Editable Email Templates — Implementation Plan

**Author:** Sarwar · **Date:** 2026-09-11 · **Status:** Implemented and verified (2026-09-12) — rebrand follow-up landed

## Goal

Every email GRS Learning sends (welcome, password reset, receipts, org invites,
application decisions, payout/order notifications, admin alerts — 21 distinct types)
was a hardcoded TypeScript string in `email.service.ts`. Admins had no way to change a
subject line or fix a typo without a code deploy, and six near-identical HTML layout
methods had drifted slightly out of sync with each other.

Build an admin panel (`/admin/email-templates`) where every email's subject and body
can be edited, previewed, and reset to default — backed by a registry of built-in
defaults so the feature ships with zero risk of leaving an email broken, and route
every send through BullMQ so a transient provider outage retries instead of silently
losing (or duplicating) an email.

---

## Architecture & decisions

- **Registry + DB override, not DB-only.** `email-templates.registry.ts` is the single
  source of truth for what emails exist, their default copy, and their documented
  `{{placeholders}}`. The `EmailTemplate` table (one row per customized key) only ever
  holds an *override* — absent a row, the registry default renders. New email type =
  one registry entry + one call site, no migration.
- **LiquidJS for placeholder rendering**, not hand-rolled regex substitution (the
  approach `AutomationRule.template` already used). Autoescape is off at the Liquid
  layer and applied once, deliberately, when building the HTML: the same rendered
  `subject`/`body` string doubles as the real email Subject header and the plain-text
  alternative, neither of which is HTML — escaping the whole rendered string only when
  composing the HTML view avoids a double-escaping bug that shipped briefly during
  development (see "Bugs found in verification" below).
- **One shared HTML layout** (`email-layout.ts`) replaces six near-duplicate private
  methods that used to live on `EmailService`. Only headline/body/CTA are
  admin-editable; header, footer, and button styling are fixed. A `protectedHtml` slot
  exists for structural content that must never be admin-editable regardless of
  template copy — e.g. the org-admin-credentials email/temp-password box.
- **`NotificationEvent` enum values double as registry keys** for the 12
  transactional emails already wired through the in-app notification system (order
  paid, payouts, application decisions, referral confirmed, …). One identifier covers
  both the in-app row and the email override — no translation table to keep in sync.
  These 12 share one shape: the template wraps whatever `title`/`body` the triggering
  call site already computed, rather than re-exposing every discrete field
  (amount, course name, …) as a separate placeholder.
- **Marketing reminders (`AutomationRule.template`) were left alone.** That system
  already lets admins edit the 5 engagement-nudge emails and has its own
  audience-targeting semantics; folding it into `EmailTemplate` was explicitly out of
  scope to avoid touching a working feature.
- **Every previously-inline `await this.email.sendXxx(...)` call became a BullMQ
  enqueue** (welcome, password reset, org invite, org admin credentials, receipt,
  admin alerts). Reminders and `NotificationEvent` emails already ran inside a BullMQ
  worker (`NotificationsProcessor`) and render+send directly there — no second queue
  hop needed for those.

---

## What shipped

### Backend (`apps/api/src/modules/email/`)

- **`email-templates.registry.ts`** (new) — `EMAIL_TEMPLATES`: 21 entries (welcome,
  password_reset, org_invite, org_admin_credentials, receipt, 12
  `NotificationEvent`-keyed transactional emails, 4 `admin_alert_*`), each with
  `label`, `category`, `description`, `defaultSubject`/`defaultBody`, `ctaLabel`, and
  a documented `variables[]` list (name, description, sample value) used both for
  admin-UI hints and to validate that a saved template doesn't reference an unknown
  placeholder.
- **`email-templates.service.ts`** (new) — `EmailTemplatesService`: `render()`
  (registry default or DB override → Liquid → shared layout), `list()`/`get()`
  (merges registry + override, `isCustomized` flag), `upsert()` (validates
  placeholders, records `updatedByUserId`), `resetToDefault()`, `preview()` (sample
  data, or an in-progress draft from the editor — this is what makes the admin
  preview pane live as you type, not just a preview of what's saved).
- **`email-layout.ts`** (new) — `renderEmailLayout()` (the shared HTML shell) and
  `credentialsBoxHtml()` (the one protected/non-editable content block in use today).
- **`email.service.ts`** (rewritten) — every `sendXxx()` method now either enqueues
  onto a new `mail` BullMQ queue (the six types above) or renders+sends directly
  (`sendReminder`, `sendNotificationEmail` — already inside a worker). The six
  collapsed private `xxxHtml()` methods and the three near-duplicate inline
  `escapeHtml()` helpers are gone.
- **`mail.processor.ts`** (new) — `MailProcessor`, the `mail` queue's consumer.
  Concurrency 5 with a `{max: 10, duration: 1000}` rate limit so a burst (e.g. a bulk
  admin-alert fan-out) doesn't serialize one email at a time or trip the provider's
  rate limit. Writes a `ReminderLog` row on every send — `SENT` on success,
  `FAILED` only once retries are exhausted (not once per attempt) — and logs an
  error on final failure via `@OnWorkerEvent("failed")`.
- **Reliability config** (in `EmailService`'s `enqueue()`): 3 attempts, exponential
  backoff (30s → 60s → 120s), a deterministic `jobId` per logical send so a retried
  request or duplicate enqueue can't double-send (BullMQ dedupes on `jobId`), and a
  bounded `removeOnFail` count so Redis doesn't grow unbounded.
- **`EmailTemplate` model** (`schema.prisma`, migration
  `add_email_templates`) — `key` (plain string, not an enum — same reasoning as
  `NotificationPreference.event`: new keys must never need a migration), `subject`,
  `body`, `ctaLabel?`, `updatedByUserId?`, timestamps. Also added `FAILED` to the
  `ReminderStatus` enum.
- **`admin.controller.ts`** — `GET/PATCH/DELETE /admin/email-templates(/:key)`,
  `POST /admin/email-templates/:key/preview`, `POST .../test-send` (renders with
  sample data and sends immediately, not queued, for instant admin feedback).
- **Bug fixed in passing**: `instructor.service.ts` / `sales-agent.service.ts` were
  sending **two** emails per application approve/reject — a bespoke
  `sendApplicationDecision()` call alongside the generic notification-event email.
  Removed the bespoke path; the admin's note now folds into the notification body
  instead.

### Frontend (`apps/web/app/admin/email-templates/`)

- **`page-client.tsx`** (new) — searchable, category-grouped list (Auth, Organizations,
  Commerce, Applications, Payouts, Admin alerts) with live 7-day sent/failed counts
  pulled from the existing `ReminderLog`-backed endpoint (no new stats endpoint
  needed — this log already covers every send, not just reminders).
- **`email-template-editor.tsx`** (new) — a modal (not a side drawer, matching the
  rest of the admin panel), styled like a compose window: fixed From/To block,
  Subject/Body/Button-label fields with clickable variable chips that insert at the
  cursor, inline unknown-placeholder validation, a live debounced preview pane, a
  desktop/mobile preview toggle, "Send test email to myself," "Reset to default"
  (with a confirm dialog), and an unsaved-changes guard on close.
- **Desktop preview redesign** (rebrand follow-up) — the desktop and mobile preview
  used to render at nearly the same width and looked identical. The modal widened
  (`max-w-4xl` → `max-w-6xl`) and desktop now renders at a genuine 600px frame with a
  browser-chrome bar (traffic-light dots) on a visible gray canvas, while mobile stays
  exactly as it was (375px, no chrome) — the two now look meaningfully different.
- New API hooks/endpoints/query-keys following the existing file conventions
  (`useEmailTemplates`, `useUpdateEmailTemplate`, `useResetEmailTemplate`,
  `usePreviewEmailTemplate`, `useSendTestEmail`).

### Rebrand follow-up (SkillStream → GRS Learning)

A separate, smaller commit after the feature landed: every default subject/body, the
shared layout's header/footer, the `From` display name in both mail providers
(Resend and SMTP), and the two static UI strings in the admin page all changed from
"SkillStream" to "GRS Learning." The outbound sending domain also moved from
`noreply@skillstream.dev` to `noreply@grslearning.dev` in `.env`/`.env.example`/the
Zod config default — production already has its own real domain configured
separately and needs no change here.

---

## Bugs found in verification

Both found by actually exercising every email type end-to-end against a local
Mailpit instance, not by code review:

1. **Every queued email was silently failing.** BullMQ rejects a custom `jobId`
   containing `:`, and every job ID (`` `welcome:${to}` ``, etc.) used `:` as a
   separator. Depending on the call site this either surfaced as a 500 (forgot-password
   was broken) or was silently swallowed (`sendWelcome`'s `.catch(() => {})`). Fixed
   by joining job IDs with `|` instead (`safeJobId()` helper).
2. **Preview/test-send never showed the credentials box** for `org_admin_credentials`
   — the real send included it correctly, but there was no sample `protectedHtml` for
   the preview path to render. Fixed by adding `sampleProtectedHtml` to that
   registry entry.

## Verification

- Full `apps/api` test suite (253/256 passing — the 3 failures are pre-existing and
  unrelated) and `tsc --noEmit` clean across `packages/shared`, `apps/web`, `apps/api`.
- Production builds (`nest build`, `next build`) both succeed.
- All 21 templates rendered and delivered via "send test email," verified in Mailpit.
- The 6 previously-direct-send email types verified through their **real** triggering
  flows (signup, forgot-password, org creation, org invite, a real checkout + PDF
  receipt, a course review triggering an admin alert) — not just the test-send button.
- The full edit→save→live-effect→reset loop verified: customized a template via the
  API, triggered a real signup, confirmed the delivered email used the custom copy
  with `{{first_name}}` correctly interpolated, then reset and confirmed it reverted.
- BullMQ reliability verified directly: enqueuing the same `jobId` twice produced
  exactly one send (BullMQ's dedup); stopping Mailpit and triggering a send produced
  exactly 3 attempts at the expected 30s/60s backoff, exactly one `FAILED`
  `ReminderLog` row (not one per attempt), and the exhausted-retries error log —
  then a fresh request succeeded immediately once Mailpit was back up.
- Confirmed the dev-only `payments/dev/simulate/:orderId` endpoint (used during this
  verification to trigger a real receipt email) already refuses when
  `NODE_ENV=production` — no payment-bypass risk shipping this branch.
