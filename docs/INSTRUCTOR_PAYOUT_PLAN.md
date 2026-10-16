# Instructor Payout — Self-Serve Withdrawal Plan (Stripe-only)

## Goal

- Instructor can withdraw earned income to their **Stripe Connect** account without an admin ticket.
- Reuse existing `payouts` module (schema, DTOs, admin approval flow) — do not rebuild.
- Close gaps that make current flow manual/incomplete: partial amounts, Stripe Transfer automation, fee accounting, confirmation step, notifications, statements, frontend UI.
- Keep admin approval as safety net (configurable auto-approve threshold), never bypass silently.
- **No PayPal, no manual bank wire, no SSLCommerz payout.** Stripe Connect only. Other providers deferred.

## Current state (baseline)

Already exists — do **not** duplicate:

- **Schema** — `apps/api/prisma/schema.prisma`
  - `InstructorProfile.earningsCents` (Int, denormalized running balance) — line 295.
  - `PayoutAccount` + `Payout` models — lines 988–1015.
  - `PayeeType` enum (`INSTRUCTOR` | `AGENT`), `PayoutStatus` (`REQUESTED` | `APPROVED` | `PAID` | `REJECTED`).
- **Service** — `apps/api/src/modules/payouts/payouts.service.ts`
  - `computeBalance()` — pure math, `available = lifetimeEarned − paidOut − inFlight`.
  - `myBalance`, `myAccount`, `setAccount`, `request`, `myPayouts`.
  - Admin: `listAll`, `approve`, `markPaid`, `reject`.
- **Controller** — `apps/api/src/modules/payouts/payouts.controller.ts`
  - `GET /me/payouts/balance`, `GET /me/payouts`, `GET|POST /me/payout-account`, `POST /me/payouts`.
  - `GET /admin/payouts`, `POST /admin/payouts/:id/{approve,mark-paid,reject}`.
- **Earnings accrual** — `apps/api/src/modules/commerce/orders.service.ts:259–269`
  - Per `OrderItem` on `PAID`, increments `InstructorProfile.earningsCents` inside fulfilment transaction.
- **Stripe already wired for incoming payments** — `apps/api/src/modules/payment/gateways/stripe/stripe.gateway.ts`, env keys `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Reuse the same `Stripe` SDK client for outgoing transfers.
- **Notifications** — `PAYOUT_APPROVED`, `PAYOUT_PAID` events already wired in `payouts.service.ts`.
- **Shared constants/DTOs** — `@grslearning/shared`: `MIN_PAYOUT_CENTS`, `PayoutAccountSchema`, `PayoutBalanceDto`, `PayoutDto`.

Gaps this plan closes:

1. **Only full-balance withdraw.** `request()` drains whole `availableCents`. No user-supplied amount.
2. **No Stripe Transfer automation.** `markPaid` is manual — admin toggles status by hand. No Stripe Connect Transfer push.
3. **No fee/tax model.** Instructor sees gross available; payout sent gross. Platform commission and Stripe fees not deducted.
4. **No confirmation step.** `POST /me/payouts` fires immediately — no OTP for money-out action.
5. **Weak account validation.** `PayoutAccount.details` free-form JSON blob; no schema for Stripe connected account.
6. **No downloadable statement.** No CSV/PDF export.
7. **No frontend page.** Backend endpoints exist; `/instructor/earnings` route not implemented in `apps/web`.
8. **No hold period.** Refund window means instructor could withdraw money from course refunded next day → negative balance.
9. **No email on request.** `PAYOUT_REQUESTED` event missing.
10. **No idempotency / rate limit.** Double-click could create two `REQUESTED` rows.

## Target architecture

```
Instructor UI
      │
      ▼
PayoutsController (self-serve routes under /me/payouts)
      │
      ▼
PayoutsService
      │
      ├─► FeeCalculator            (platform commission + Stripe fee)
      ├─► StripeAccountValidator   (Zod schema for connected account id)
      ├─► HoldPeriodPolicy         (excludes earnings inside refund window)
      ├─► ConfirmationService      (OTP re-auth)
      │
      ▼
StripePayoutService (Stripe Transfers API)
      │
      ▼
Stripe → instructor's connected account (acct_xxx)
```

Single provider. No `PayoutProvider` interface / factory — Stripe hardcoded. If PayPal/manual bank added later, refactor to interface then (YAGNI now).

### 1. Stripe Connect setup

Instructor must onboard as Stripe Express connected account. New flow:

```
POST /me/payout-account/stripe/onboard-link
  → creates AccountLink via stripe.accountLinks.create({ type: "account_onboarding" })
  → returns { url } → FE redirects instructor to Stripe hosted onboarding

Stripe redirects back to `${FRONTEND_URL}/instructor/earnings?stripe=onboarded`

GET /me/payout-account/stripe/status
  → stripe.accounts.retrieve(acct_xxx)
  → returns { chargesEnabled, payoutsEnabled, requirementsDue: [...] }
```

Store the `acct_xxx` id in `PayoutAccount.details.connectedAccountId`. Onboarding creates the account if missing (`stripe.accounts.create({ type: "express", ... })`).

### 2. Amount + fee model

New `FeeCalculator` (`apps/api/src/modules/payouts/fees/fee-calculator.ts`):

```ts
interface PayoutBreakdown {
  requestedCents: number;      // what instructor typed
  platformFeeCents: number;    // e.g. 5% of requested (env: PAYOUT_PLATFORM_FEE_BPS)
  stripeFeeCents: number;      // Stripe Connect Transfer fee (0.25% + $0.25 US, region-dependent)
  netCents: number;            // sent to instructor
}
```

Contract: `net = requested − platformFee − stripeFee`. All non-negative; `net ≥ env.PAYOUT_MIN_NET_CENTS`.

Persist breakdown on `Payout`. New Prisma fields:

```prisma
platformFeeCents  Int      @default(0)
stripeFeeCents    Int      @default(0)
netCents          Int      // amountCents stays = gross for backward compat
providerRef       String?  // Stripe transfer id (tr_xxx)
holdReleasedAt    DateTime?
```

### 3. Partial amount + confirmation flow

Change `POST /me/payouts` body from empty to:

```ts
// packages/shared/src/payouts.ts
export const RequestPayoutSchema = z.object({
  amountCents: z.number().int().positive(),
  confirmationToken: z.string().min(6), // from ConfirmationService
});
```

New pre-step endpoints:

```
POST /me/payouts/quote            → body { amountCents } → returns PayoutBreakdown (no writes)
POST /me/payouts/confirm-intent   → sends OTP to instructor's verified email, returns {confirmationToken}
POST /me/payouts                  → body { amountCents, confirmationToken } → creates row
```

Guards on `POST /me/payouts`:

- `amountCents ≤ availableCents` (after hold-period deduction).
- `netCents ≥ env.PAYOUT_MIN_NET_CENTS`.
- No open `REQUESTED`/`APPROVED` row (existing `hasOpenRequest`).
- Confirmation token unused, not expired (5-min TTL, single-use).
- Stripe account `payoutsEnabled === true`.

### 4. Hold-period policy

Refund window (e.g. 14 days). Earnings from `Order.paidAt > now − 14d` counted as **pending**, not **available**.

Extend `computeBalance()`:

```ts
export function computeBalance(input: {
  lifetimeEarnedCents: number;
  pendingReleaseCents: number;   // NEW
  paidOutCents: number;
  inFlightCents: number;
  minPayoutCents: number;
  hasAccount: boolean;
}) { availableCents = max(0, lifetimeEarned − pendingRelease − paidOut − inFlight); ... }
```

`pendingReleaseCents` = repo query summing instructor's earnings from orders inside hold window and not refunded. Window from `env.PAYOUT_HOLD_DAYS` (default `14`).

`PayoutBalanceDto` grows `pendingReleaseCents` + `pendingReleaseAt` so UI can show "$X releases Mar 20".

### 5. Stripe account validation

Replace free-form `PayoutAccountSchema`:

```ts
export const PayoutAccountSchema = z.object({
  method: z.literal("STRIPE"),
  details: z.object({
    connectedAccountId: z.string().regex(/^acct_[A-Za-z0-9]+$/),
  }),
});
```

Instructor never types this directly — filled by the Stripe onboarding callback. Form-side UI just shows "Connect with Stripe" button.

### 6. Automated transfer + webhook reconciliation

New `StripePayoutService` (`apps/api/src/modules/payouts/stripe-payout.service.ts`):

```ts
async executeTransfer(payoutId: string): Promise<void> {
  const p = await repo.findPayoutById(payoutId);
  const account = await repo.findPayoutAccount(p.payeeUserId);

  const transfer = await stripe.transfers.create({
    amount: p.netCents,
    currency: "usd",
    destination: account.details.connectedAccountId,
    transfer_group: p.id,
    metadata: { payoutId: p.id, payeeUserId: p.payeeUserId },
  }, { idempotencyKey: `payout_${p.id}` }); // Stripe's built-in idempotency

  await repo.updatePayout(p.id, {
    providerRef: transfer.id,
    status: "PAID",
    processedAt: new Date(),
  });
}
```

Called by:

- Auto-approve path: `request()` → if under threshold → `executeTransfer()` inline.
- Admin `approve()`: transitions `REQUESTED → APPROVED`, enqueues `executeTransfer()`.

Webhook — extend existing Stripe webhook handler:

```
POST /webhooks/stripe (existing)
  handle event.type:
    "transfer.paid"     → mark PAID (already handled by sync path, this is fallback)
    "transfer.failed"   → mark REJECTED, notify PAYOUT_FAILED, roll back inFlight
    "transfer.reversed" → mark REJECTED, increment earningsCents back
```

Auto-approve rule (config): if `netCents ≤ env.PAYOUT_AUTO_APPROVE_CENTS` AND `payoutsEnabled === true` AND ≥ N prior successful payouts → auto-transition + enqueue transfer. Otherwise stays `REQUESTED` for admin review.

### 7. Notifications

Add events (mirror existing `PAYOUT_APPROVED`/`PAYOUT_PAID` pattern at `payouts.service.ts:166–175`):

- `PAYOUT_REQUESTED` → instructor: "Withdrawal request received, pending approval".
- `PAYOUT_ADMIN_ALERT` → admins for manual-review payouts (`AdminAlertsService`).
- `PAYOUT_REJECTED` → make explicit email template.
- `PAYOUT_FAILED` → Stripe `transfer.failed` webhook.

Templates in `EmailService` (see `EMAIL_SERVICE_PLAN.md`).

### 8. Idempotency + concurrency

- `request()` inside `prisma.$transaction` with `SERIALIZABLE` isolation OR `SELECT ... FOR UPDATE` on instructor row → two concurrent requests cannot both pass `hasOpenRequest`.
- HTTP-level: accept `Idempotency-Key` header on `POST /me/payouts`; small `PayoutIdempotency` table keyed by `(userId, key)` → returns same `Payout` row on retry.
- Stripe SDK call uses `idempotencyKey: payout_${payoutId}` — Stripe dedupes on their side too.
- FE disables button on submit.

### 9. Statements / export

```
GET /me/payouts/statement.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
GET /me/payouts/statement.pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
```

CSV: one row per `OrderItem` in range: `courseTitle, buyerEmail, grossCents, platformFeeCents, netCents, orderPaidAt`.
PDF: reuse existing PDF pipeline used by `sendReceipt`.

### 10. Frontend (apps/web)

New route `apps/web/app/(instructor)/instructor/earnings/page.tsx`:

- **Balance card**: `available`, `pendingRelease` (with release date), `lifetimeEarned`, `paidOut`.
- **Stripe connect section**:
  - Not onboarded → "Connect with Stripe" button → hits `POST /me/payout-account/stripe/onboard-link` → redirects to Stripe hosted form.
  - Onboarded → shows `Connected: acct_****xyz` + `payoutsEnabled` badge. If `requirementsDue.length > 0` → "Complete verification" link back to Stripe.
- **Withdraw button** → opens modal:
  1. Amount input (validated ≤ available).
  2. Live fee breakdown from `POST /me/payouts/quote`.
  3. "Send code" → email OTP.
  4. Enter code → `POST /me/payouts` with `{ amountCents, confirmationToken }`.
- **Payout history table** with status pills, `providerRef` links to Stripe dashboard (`https://dashboard.stripe.com/transfers/{providerRef}`).
- **Statement download** (CSV/PDF) with date range picker.

## Env changes (`apps/api/src/config/env.ts`)

```ts
PAYOUT_HOLD_DAYS: z.coerce.number().int().min(0).default(14),
PAYOUT_AUTO_APPROVE_CENTS: z.coerce.number().int().min(0).default(0), // 0 = never auto
PAYOUT_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(500), // 5%
PAYOUT_MIN_NET_CENTS: z.coerce.number().int().min(100).default(2_500), // $25
STRIPE_CONNECT_CLIENT_ID: z.string().optional(), // for Standard connect; not needed for Express
STRIPE_CONNECT_RETURN_URL: z.string().url(),      // where Stripe sends instructor back after onboarding
STRIPE_CONNECT_REFRESH_URL: z.string().url(),     // where Stripe sends if onboarding link expires
```

Reuse existing `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. No new gateway credentials.

## Directory layout after this plan

```
apps/api/src/modules/payouts/
├── payouts.module.ts                    # + StripePayoutService provider
├── payouts.controller.ts                # + confirm-intent, quote, statement, stripe onboard endpoints
├── payouts.service.ts                   # + partial-amount request, auto-approve routing
├── payouts.repository.ts                # + pendingRelease query, idempotency lookup
├── stripe-payout.service.ts             # NEW — Stripe Transfers + onboarding + status
├── fees/
│   └── fee-calculator.ts                # pure fn: gross → breakdown
├── hold/
│   └── hold-period.policy.ts            # queries orders in refund window
├── confirmation/
│   └── confirmation.service.ts          # OTP issue + verify (reuses EmailService)
└── __tests__/
    ├── fee-calculator.test.ts
    ├── hold-period.policy.test.ts
    ├── stripe-payout.service.test.ts
    └── payouts.service.test.ts          # extend existing
```

Stripe webhook handling stays in the existing `apps/api/src/modules/payment/gateways/stripe/` handler — add `transfer.*` event branches there.

## Testing plan

- `fee-calculator.test.ts` — table-driven: gross → (platform, stripe, net) for USD.
- `hold-period.policy.test.ts` — orders inside/outside window, refunded orders excluded.
- `stripe-payout.service.test.ts` — mock `Stripe` SDK; assert `transfers.create` payload, idempotencyKey, error propagation.
- `payouts.service.test.ts` (extend):
  - partial amount ≤ available succeeds; > available rejects.
  - concurrent `request()` — only one row created (SERIALIZABLE tx test).
  - confirmation token: valid, expired, reused, wrong user.
  - auto-approve threshold: below → auto, above → stays `REQUESTED`.
- Webhook test: signed `transfer.failed` → row → `REJECTED` + `earningsCents` restored.
- E2E: seed instructor with paid orders + Stripe test connected account → `/me/payouts/balance` → `/me/payouts/confirm-intent` → `/me/payouts` → assert row + notification + Stripe test dashboard has transfer.

## Migration steps (PR-sized commits)

1. **Schema + fee calculator** — add `netCents`, `platformFeeCents`, `stripeFeeCents`, `providerRef`, `holdReleasedAt` to `Payout`. Add `FeeCalculator`. Backfill: `netCents = amountCents`, fees = `0`.
2. **Hold-period policy + balance DTO** — add `pendingReleaseCents`/`pendingReleaseAt` to `PayoutBalanceDto`, update `computeBalance()`, wire repo query.
3. **Partial amount + confirmation + quote** — new `RequestPayoutSchema`, `confirmation.service.ts`, `POST /me/payouts/quote`, `POST /me/payouts/confirm-intent`, updated `POST /me/payouts`. Keep whole-balance path as default when `amountCents` missing (backward compat).
4. **Stripe account schema + onboarding endpoints** — swap `PayoutAccountSchema` to Stripe-only shape. Add `POST /me/payout-account/stripe/onboard-link` + `GET /me/payout-account/stripe/status`.
5. **`StripePayoutService` + auto-approve + webhook branches** — `executeTransfer()`, wire `approve()` to enqueue it, extend existing Stripe webhook handler for `transfer.paid/failed/reversed`. Notifications: `PAYOUT_REQUESTED`, `PAYOUT_FAILED`.
6. **Statement export** — CSV first, PDF second.
7. **Frontend earnings page** — new route, replaces dead `payoutHref()` link.
8. **Idempotency table + rate limit** — last, once flow is stable.

Each step independently deployable and reversible.

## Cross-module usage pattern

No callers outside `payouts` change. Earnings accrual in `orders.service.ts:259–269` untouched — still increments `InstructorProfile.earningsCents`. Hold-period policy reads `OrderItem` at balance-computation time; no new write path.

## Non-goals

- PayPal, manual bank wire, SSLCommerz payouts. Stripe only.
- Multi-currency. USD only for MVP. FX is Stripe's problem.
- Tax form generation (1099-K, VAT invoices).
- Instructor-to-instructor transfers or gifting.
- Advance/loan against pending balance.
- Replacing admin approval entirely — auto-approve is opt-in per-instructor and capped by amount.

## Risks

- **Refund after payout.** Even with hold period, chargeback outside window can create negative balance. Mitigation: `earningsCents` goes negative on chargeback; `availableCents` clamped `≥ 0`; instructor cannot request until balance climbs back positive.
- **Stripe Transfer requires platform balance.** Stripe Transfers pull from the platform's Stripe balance. If balance is empty (funds already swept to bank), transfer fails with `insufficient_funds`. Mitigation: keep Stripe payout schedule to manual on platform account OR maintain a rolling reserve. Document minimum platform balance = sum of instructor available balances.
- **Onboarding drop-off.** Instructor may abandon Stripe onboarding halfway → `payoutsEnabled === false`. Mitigation: `GET status` polls, UI shows outstanding requirements, `refresh_url` re-issues link.
- **Fee model drift.** Stripe changes fee formula. Mitigation: fee calculator is one pure function; update in one place.
- **OTP fatigue.** Delivery lag locks instructor out. Mitigation: fallback to password re-entry as alternative `confirmationToken` source.
- **Concurrent requests.** SERIALIZABLE tx + Stripe idempotencyKey.
- **PII in `PayoutAccount.details`.** `acct_xxx` id is not sensitive on its own (public-ish identifier) — but still mask in list responses. No bank/routing numbers stored; Stripe holds those.

## Deliverables checklist

- [ ] Prisma migration: `Payout` new fields, backfill.
- [ ] `fees/fee-calculator.ts` + tests.
- [ ] `hold/hold-period.policy.ts` + tests.
- [ ] `confirmation/confirmation.service.ts` (OTP) + tests.
- [ ] `stripe-payout.service.ts` (onboard link, status, executeTransfer) + tests.
- [ ] `POST /me/payouts/quote`, `POST /me/payouts/confirm-intent`, updated `POST /me/payouts`.
- [ ] `POST /me/payout-account/stripe/onboard-link`, `GET /me/payout-account/stripe/status`.
- [ ] Extend existing Stripe webhook handler with `transfer.paid/failed/reversed` branches.
- [ ] `env.ts` new keys (hold days, auto-approve cents, fee bps, min net, Stripe connect return/refresh URLs).
- [ ] `packages/shared`: `RequestPayoutSchema`, Stripe-only `PayoutAccountSchema`, updated `PayoutBalanceDto` (`pendingReleaseCents`, `pendingReleaseAt`), `PayoutBreakdownDto`.
- [ ] `GET /me/payouts/statement.{csv,pdf}`.
- [ ] `apps/web/app/(instructor)/instructor/earnings/page.tsx` + withdraw modal + Stripe connect section.
- [ ] Email templates: `PAYOUT_REQUESTED`, `PAYOUT_REJECTED`, `PAYOUT_FAILED`.
- [ ] Idempotency table + `Idempotency-Key` handling.
- [ ] Reconcile cron for stuck `APPROVED` payouts (poll `stripe.transfers.retrieve`).
