# Refund-to-Credit Plan

## Goal
Admin refunds an order → student loses course access (existing behavior) → student receives a **notification with an admin comment** → the refunded amount is granted as **store credit** on the student's account → student can apply that credit at checkout on a future purchase.

## Current State (verified)
- Admin refund endpoint: `POST /admin/orders/:id/refund` — `apps/api/src/modules/admin/admin.controller.ts:85`
- Refund service: `apps/api/src/modules/admin/admin.service.ts:471` calls `applyRefundToLedger()` at :492 (transactional).
- Refund revokes access: `apps/api/src/modules/admin/admin.repository.ts:310` (`deleteEnrollmentsForRefund`).
- Order status enum has `REFUNDED`: `apps/api/prisma/schema.prisma:107`.
- **No wallet / credit / voucher model exists** (checked schema — zero matches).
- Notifications: `notifications.service.ts:65` `notify(userId, event, title, body, href)` + `NotificationEvent` enum at `schema.prisma:153`. No refund/credit events yet.
- Checkout pricing pipeline: `checkout.service.ts:quote()` at :43 → subtotal → coupon discount at :68 → total. Credit deduction hooks here.
- Admin orders UI: refund is a plain button, no modal — `apps/web/app/admin/orders/page.tsx:302`.
- Dialog base: `apps/web/components/ui/dialog.tsx` (usable for comment modal).

## Scope Decisions
- **Credit is non-refundable, non-transferable, no expiry (v1).** Simple ledger; no cash-out.
- **Currency = order currency.** Store credit in the order's currency, kept as cents. Reject applying credit if the checkout currency differs from the credit balance's currency (v1 supports a single currency per user; multi-currency later).
- **Full refund only (v1).** Partial refunds out of scope. Amount granted as credit = `order.totalCents`.
- **Admin comment is required** (min 3 chars, max 500). Stored on the credit ledger row and shown in the student notification body.
- **Applying credit at checkout is optional** — student toggles "Apply my credit" and the discount is capped at `min(availableCreditCents, totalCentsAfterCoupon)`. Gateway is skipped only when the final total is 0.
- **Credit stacks with coupons** — coupon applied first, then credit reduces the remainder.
- **No enrollment restoration** if the student re-buys the same course; new enrollment is created (matches current refund behavior).

## Data Model
Add to `apps/api/prisma/schema.prisma`:

```prisma
model StudentCreditLedger {
  id          String            @id @default(cuid())
  userId      String
  amountCents Int               // positive = granted, negative = spent
  currency    String            // e.g. "BDT" / "USD" — matches order currency
  reason      CreditLedgerReason
  orderId     String?           // source order (for GRANT_REFUND) or spend order (for SPEND)
  adminUserId String?           // who granted (nullable — spends have no admin)
  comment     String?           // admin comment on GRANT_REFUND; null on SPEND
  createdAt   DateTime          @default(now())

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  order Order? @relation(fields: [orderId], references: [id], onDelete: SetNull)

  @@index([userId, currency, createdAt])
  @@index([orderId])
}

enum CreditLedgerReason {
  GRANT_REFUND    // admin granted credit from an order refund
  SPEND_CHECKOUT  // student applied credit at checkout
  ADJUST_MANUAL   // reserved for future admin adjustments
}
```

Add to `NotificationEvent` enum (`schema.prisma:153`):
```
ORDER_REFUNDED
CREDIT_GRANTED
```
(One combined notification is fine — pick `ORDER_REFUNDED` and put credit info in body. Keep `CREDIT_GRANTED` reserved for future manual grants.)

**Balance = SUM(amountCents) WHERE userId=? AND currency=?.** Never store denormalized balance; always aggregate. Add a helper `creditsRepository.getBalance(userId, currency)`.

Migration folder: `apps/api/prisma/migrations/{timestamp}_add_student_credit_ledger/`.

## API Changes

### 1. Refund endpoint accepts a comment
`POST /admin/orders/:id/refund` — extend body:
```ts
class RefundOrderDto { comment: string; /* required, 3..500 */ }
```
- Controller: `admin.controller.ts:85` — add `@Body() dto`.
- Service: `admin.service.ts:refundOrder()` — pass `comment` through.
- Inside `applyRefundToLedger()` transaction (`admin.service.ts:492`), after existing writes:
  1. Insert `StudentCreditLedger` row: `GRANT_REFUND`, `amountCents = order.totalCents`, `currency = order.currency`, `orderId`, `adminUserId`, `comment`.
  2. Call `notifications.notify({ userId: order.userId, event: 'ORDER_REFUNDED', title: 'Order refunded', body: \`Your order for X was refunded. Reason: \${comment}. \${formatMoney(amount)} added as store credit.\`, href: '/dashboard/credits' })`.
- Everything stays in one Prisma transaction so a notification/ledger failure rolls back the refund.

### 2. Student credit endpoints
New module: `apps/api/src/modules/credits/` — controller/service/repository.
- `GET /me/credits` → `{ balances: [{ currency, amountCents }], history: LedgerEntryDto[] }`. Paginate history.
- Wire `credits.service.getBalance(userId, currency)` for reuse by checkout.

### 3. Checkout applies credit
Extend `quote()` DTO (`commerce/checkout.service.ts:43`) with `applyCredit?: boolean`. Response adds `creditAppliedCents: number` and `availableCreditCents: number`.
- Order of operations: `subtotal → coupon → creditApplied = min(balance, subtotal - discount) → total`.
- `createSession()` (:118): if `applyCredit`, in the same transaction that inserts `Order`:
  1. Re-read balance (avoid TOCTOU).
  2. Recompute `creditAppliedCents` — reject with 409 if balance decreased below what the quote assumed.
  3. Insert negative `StudentCreditLedger` row: `SPEND_CHECKOUT`, `amountCents = -creditApplied`, `currency`, `orderId = newOrder.id`.
  4. Persist `creditAppliedCents` on the `Order` (add column) so refunds can reason about it later.
- If `totalCents == 0` after credit, skip gateway, mark order `PAID`, enroll immediately (mirror existing free-course path if any; otherwise short-circuit `createSession`).

### 4. Refund of an order that used credit
Add to plan doc only for v1: if `order.creditAppliedCents > 0`, the refund credit granted equals `order.totalCents + order.creditAppliedCents` (i.e. return both the money-paid portion as credit AND the credit portion). Simpler alternative for v1: **restrict admin refund to orders where `creditAppliedCents == 0`**. Pick the restrictive path for v1 and revisit later.

## Frontend Changes

### Admin — refund modal
`apps/web/app/admin/orders/page.tsx:302`
- Replace direct `refundMutation.mutate(id)` with a `Dialog` (mirror `components/ui/dialog.tsx`).
- Modal contents:
  - Order summary (id, student email, total).
  - `Textarea` for **comment** (required, counter, 3..500).
  - Confirm button disabled until valid; runs `refundMutation.mutate({ id, comment })`.
- Update `adminApi.refundOrder` (`apps/web/lib/api/endpoints.ts:271`) signature to accept `{ id, comment }`.

### Student — credits page
New page: `apps/web/app/(student)/dashboard/credits/page.tsx`
- Header: available balance per currency.
- Table: ledger history (date, reason, amount, order link, admin comment).
- Link surfaced from the account menu.

### Cart / checkout — apply credit toggle
`apps/web/app/(storefront)/cart/page.tsx` and `checkout/page.tsx`
- Fetch balance (or read from `quote()` response).
- Toggle: "Apply my store credit (\{formatMoney(available)\} available)".
- On toggle, re-quote with `applyCredit: true`; render new "Credit applied: -\{...\}" row in summary.
- Disable toggle when currencies mismatch; show helper text.

### Notification bell
No change required — existing bell (`components/shared/notification-bell.tsx`) already renders any event with a title/body/href. The new `ORDER_REFUNDED` event flows through automatically.

## Shared DTOs
`packages/shared/src/` (or wherever `AuthUserDto` etc. live):
- `RefundOrderDto`, `CreditLedgerEntryDto`, `CreditBalanceDto`, extend `QuoteRequestDto` / `QuoteResponseDto`.

## Testing
- API unit tests
  - `refundOrder`: rejects without comment; grants correct amount; creates notification; rolls back on failure.
  - `credits.getBalance`: aggregates positive + negative rows correctly.
  - `checkout.quote` with `applyCredit`: coupon-then-credit ordering; caps at post-coupon total.
  - `checkout.createSession` with `applyCredit`: TOCTOU race guarded; SPEND row inserted in same tx.
  - Refund of order with `creditAppliedCents > 0`: blocked with 409 (v1).
- E2E (or manual QA script)
  1. Buy course A → admin refunds with comment → student sees notification and credit balance.
  2. Buy course B with credit toggle → total reduced → ledger shows SPEND row.
  3. Buy course C where credit ≥ total → order PAID with no gateway call → enrollment created.

## Rollout Steps
1. Schema + migration (`add_student_credit_ledger` + `NotificationEvent` values + `Order.creditAppliedCents` column).
2. Backend: refund comment + ledger write + notification.
3. Frontend: admin refund modal.
4. Backend: credits module (balance + history endpoints).
5. Frontend: student credits page.
6. Backend + frontend: checkout `applyCredit` end-to-end.
7. Add v1 guard: refund blocked when `Order.creditAppliedCents > 0`.
8. QA pass, ship.

## Open Questions
- Do we want an expiry policy for credit (e.g. 12 months)? v1 = none.
- Should partial refunds be introduced now or later? Plan says later.
- Multi-currency: keep single-currency balance in v1, or already model per-currency wallets? Plan uses per-currency ledger — no schema change needed to expand later.
