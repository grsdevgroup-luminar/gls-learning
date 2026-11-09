# Delivery Partner Payout — Stripe Connect Parity Plan

## Goal

Delivery partners withdraw commission to their own **Stripe Connect Express** account, using the same flow as instructors: connect Stripe, get a fee quote, choose a partial amount, admin approves, then the Stripe Transfer runs automatically.

Reuse the existing `payouts` module. Don't build a second ledger.

## Current state

The backend is already mostly payee-generic:

- `PayoutsService.payeeContext()` resolves `DELIVERY_PARTNER` and uses `DeliveryPartner.totalEarningsCents` as lifetime earned.
- All `/me/payouts*` and `/me/payout-account/stripe/*` routes work for any payee, because the role is derived server-side.
- `Payout.payeeType` is already `DELIVERY_PARTNER` for partner rows. The admin `/admin/payouts` page already lists them.
- `payoutHref()` already deep-links partner notifications to `/delivery-partner/earnings`.
- Refunds already claw back commission through `admin.repository.ts:reverseReferralEarnings`. A paid commission lowers `totalEarningsCents`, which reduces the next available balance.

## Gaps

| # | Gap | Where |
|---|-----|-------|
| 1 | The partner UI uses the legacy `PayoutPanel` (a manual PayPal/Bank text field, full balance only, no quote). Instructors use the Stripe-based `InstructorPayoutPanel`. | `apps/web/app/delivery-partner/earnings/page-client.tsx` |
| 2 | **Bug:** the Stripe `approve()` path goes straight to `PAID` but skips partner settlement. `pendingEarningsCents` and `paidEarningsCents` never move, and referrals stay `CONFIRMED`. Only `markPaid()` (the manual path) settles them. | `payouts.service.ts` `approve()` |
| 3 | `markPartnerReferralsPaid()` flips **all** `CONFIRMED` referrals to `PAID`, even when the payout was partial. | `payouts.repository.ts` |
| 4 | The Stripe onboarding return and refresh URLs come from one global env var hardcoded to `/instructor/earnings`, so a partner would land on the instructor portal. | `stripe-payout.service.ts`, `.env.example` |
| 5 | Partner settlement uses gross `amountCents`. That's correct (gross is what leaves the balance), but it's undocumented and untested. | `markPaid()` |
| 6 | The partner earnings cards mislabel `pendingEarningsCents` as "Awaiting order confirmation". The value is really confirmed but unpaid. | partner earnings page |
| 7 | `InstructorPayoutPanel` lives under `components/instructor/` and its copy says "instructor". | web |

## Design

### Backend

**A. One settlement helper, called on every path to `PAID`**

```ts
// payouts.service.ts
private async settlePayee(payout: Payout, tx: Db) {
  if (payout.payeeType !== "DELIVERY_PARTNER") return;
  const partner = await this.repo.findDeliveryPartnerIdByUser(payout.payeeUserId, tx);
  if (!partner) return;
  await this.repo.applyPartnerPayoutSettlement(partner.id, payout.amountCents, tx);
  await this.repo.markPartnerReferralsPaidFifo(partner.id, payout.amountCents, tx);
}
```

- Call it from `approve()` (Stripe branch, inside the existing `$transaction`) and from `markPaid()`, replacing the inline block there.
- The future `transfer.reversed` webhook uses the inverse helper (`unsettlePayee`), deferred to the webhook step of the instructor plan.

**B. FIFO referral marking for partial payouts**

`markPartnerReferralsPaidFifo(partnerId, amountCents, tx)`:
- Load `CONFIRMED` referrals ordered by `createdAt ASC` with `commissionCents - reversedCents`.
- Walk the list, marking a referral `PAID` while the running total stays ≤ `amountCents`.
- Leave a referral that's only partly covered as `CONFIRMED`. The balance math uses the aggregate counters, not referral status, so money is never lost. Status is display-only.

**C. Per-payee Stripe return URL**

- Replace the single env var with a base URL plus a path chosen per payee type:
  - `STRIPE_CONNECT_RETURN_URL` / `STRIPE_CONNECT_REFRESH_URL` stay valid as instructor defaults (backward compatible).
  - Add optional `STRIPE_CONNECT_PARTNER_RETURN_URL` / `STRIPE_CONNECT_PARTNER_REFRESH_URL`. If they're unset, derive them from `FRONTEND_URL` + `/delivery-partner/earnings?stripe=onboarded|refresh`.
- `createOnboardingLink(accountId, payeeType)` picks the pair. `createStripeOnboardLink()` passes `payeeType` from `payeeContext()`.

**D. Guard: only approved partners can onboard or request**

`payeeContext()` currently returns a partner in any status. Add a check that `partner.status === "APPROVED"` for `createStripeOnboardLink` and `request`. Suspended or rejected partners can still read balance and history.

**E. Fees**

Same `calculatePayoutBreakdown()` as instructors. `PAYOUT_PLATFORM_FEE_BPS` applies to partners too, unless decided otherwise (see Open questions). If a separate rate is wanted: add `PAYOUT_PARTNER_PLATFORM_FEE_BPS` and have `feeConfig(payeeType)` choose it.

### Frontend

**F. Generalize the Stripe panel**

- Move `components/instructor/instructor-payout-panel.tsx` to `components/shared/stripe-payout-panel.tsx` and export `StripePayoutPanel`.
- Keep `InstructorPayoutPanel` as a re-export so the instructor page doesn't change.
- Change the copy from "instructor" to neutral wording. The `?stripe=onboarded` handling works for any route.

**G. Partner earnings page**

- Swap `<PayoutPanel />` for `<StripePayoutPanel />`.
- Relabel the stat cards:
  - "Pending": "Confirmed, unpaid". Source: `pendingEarningsCents`.
  - Drop the duplicate "Confirmed" card, or rename it to "Available to withdraw" from `payoutBalance.availableCents`.
  - Add a "Pending confirmation" card that sums `PENDING` referrals client-side (these aren't in `totalEarningsCents` yet).
- Keep the commission tables as they are.

**H. Legacy `PayoutPanel`**

Once no page imports it, delete it. Partners who already saved PayPal/BANK accounts:
- Open `REQUESTED`/`APPROVED` legacy payouts can still be finished with admin `markPaid` (that path is unchanged).
- New requests require Stripe. `request()` already checks `payoutsEnabled` for the STRIPE method. Add a rule that rejects non-STRIPE methods for new requests.

### Admin

- The `/admin/payouts` list already shows partner rows. Add a `payeeType` filter to `AdminPayoutQuerySchema` and the UI.
- Show the Stripe `providerRef` link for partner rows too (same as instructors).

## Tests

- `payouts.test.ts`:
  - Partner Stripe `approve()`: row is `PAID`, `pendingEarningsCents` down by gross, `paidEarningsCents` up by gross.
  - Partial payout: only referrals fully covered FIFO become `PAID`.
  - A partner with status other than `APPROVED` is rejected by `request` and `onboard-link`.
  - Instructor `approve()` doesn't touch any partner tables.
- `stripe-payout.service` test: the partner `payeeType` gets the partner return and refresh URLs.
- `fee-calculator`: unchanged, unless a separate partner fee rate is added.

## Steps (PR-sized)

1. **Settlement bug fix.** Add `settlePayee()` + FIFO marking, wire both `approve` and `markPaid`, add tests. Ship first. This is a real bug today.
2. **Per-payee onboarding URLs** + approved-partner guard + env/`.env.example`.
3. **Generalize the web panel** (`StripePayoutPanel`) and swap it into the partner earnings page. Relabel the cards.
4. **Stripe-only for new requests** + delete the legacy `PayoutPanel`.
5. **Admin `payeeType` filter.**

## Non-goals

- Hold period, OTP confirmation, statements, idempotency table, and `transfer.*` webhooks. These are unbuilt for instructors too. When they're added to the shared `payouts` module, partners get them automatically.
- Multi-currency.
- PayPal or bank payouts.

## Decisions

1. Partners pay the same platform payout fee as instructors (`PAYOUT_PLATFORM_FEE_BPS`). No separate partner rate.
2. New payout requests are Stripe-only for every payee. Legacy PAYPAL/BANK payouts that are already open can still be closed with admin `markPaid`.
