# Payment Idempotency — Implementation Plan

## Goal

Make checkout safe against duplicate submissions and provider-side retries. Today `POST /checkout/session` will happily create a second PENDING `Order` (and a second Stripe/PayPal/SSLCommerz session) on a double-click. Webhook dedup + `Enrollment @@unique([userId, courseId])` prevent duplicate access, but do **not** prevent a duplicate charge if the second session gets paid before the first is canceled.

Three layers of defense, in dependency order:

1. **Server idempotency key** — client-supplied `Idempotency-Key` collapses retries of the same `POST /checkout/session` onto a single `Order` row.
2. **Provider idempotency** — pass `idempotency_key` to Stripe (and equivalents to PayPal / SSLCommerz) so their SDKs return the same session/intent on retry instead of creating a new one.
3. **Client double-submit guard** — disable the Pay button and dedupe in-flight requests to reduce load and race windows.

Each layer independently useful; ship 1 → 2 → 3.

---

## Constraints & decisions

- Scope: idempotency for `POST /checkout/session` only. Webhook dedup and `Enrollment` upsert are already idempotent (`payments.service.ts:96-128`, `enrollment.service.ts:203-228`) — leave untouched.
- Key generation: **client** produces a fresh ULID per checkout attempt (not per button click). Persist in React state; only rotate when the cart contents change. Header name: `Idempotency-Key` (RFC 8894 convention, same as Stripe).
- Key TTL: 24h. Older keys expire and can be reused. Enforced at read time by comparing `Order.createdAt`.
- Key uniqueness: `@@unique([userId, idempotencyKey])` — same key from different users must not collide.
- Replay semantics: replay of the same key returns the **existing** `Order` (and its cached `CheckoutSessionDto`) — never mutates the order, never re-hits the gateway.
- Cart-change guard: if the incoming payload (courseIds, coupon, gateway, referral) differs from the stored `Order`, reject with 409. Never silently return a stale session for a different cart.
- Provider keys: derive from the DB `Order.id` — stable across replays, unique per order. Do **not** re-use the client `Idempotency-Key` (client key is per attempt; provider key is per order).
- Migration: `idempotencyKey String?` optional column — old orders have null, new orders required-on-write via service, not schema. Keeps rollout safe.

---

## Step 1 — Server idempotency on `POST /checkout/session`

### 1.1 Schema

`apps/api/prisma/schema.prisma:489` (`Order` model)

```prisma
model Order {
  id                String         @id @default(cuid())
  userId            String
  // …existing fields…
  idempotencyKey    String?
  // …
  @@unique([userId, idempotencyKey], name: "user_idempotency_key")
  @@index([userId])
  @@index([status])
  @@index([agentId])
}
```

Migration: `pnpm --filter api prisma migrate dev --name order_idempotency_key`.

The unique constraint is partial (Prisma emits `WHERE idempotencyKey IS NOT NULL` only on Postgres via `@@unique(..., map:)` — verify locally; if it does not, add a raw SQL migration for the partial index).

### 1.2 Contract

`packages/shared/src/contracts/checkout.ts:11`

No schema change to `checkoutSessionSchema` — the key travels in the header, not the body.

### 1.3 Controller

`apps/api/src/modules/commerce/checkout.controller.ts:59`

```ts
@Post("checkout/session")
session(
  @CurrentUser() user: RequestUser,
  @ZodBody(checkoutSessionSchema) body: CheckoutSessionInput,
  @Headers("idempotency-key") idempotencyKey?: string,
) {
  return this.checkout.createSession(user.id, body, idempotencyKey);
}
```

- Header optional for backwards compatibility during rollout. Flip to required after web client updates.
- Trim + validate: reject `> 128` chars, reject non-`[A-Za-z0-9_-]` chars — protects the unique index from garbage payloads.

### 1.4 Service

`apps/api/src/modules/commerce/checkout.service.ts:102` (`createSession`)

Insert BEFORE the "already own these courses" check:

```ts
if (idempotencyKey) {
  const existing = await this.repo.findOrderByIdempotencyKey(userId, idempotencyKey);
  if (existing) {
    // Reject if the payload differs from the stored order — avoids leaking
    // a paid session for a different cart back to the caller.
    this.assertSamePayload(existing, input);
    // Order already fulfilled → return the success URL directly.
    if (existing.status !== "PENDING")
      return { orderId: existing.id, gateway: existing.gateway, redirectUrl: this.payments.successUrl(existing.id) };
    // PENDING → resurrect the gateway session (Stripe sessions are idempotent
    // when re-created with the same idempotency_key; see step 2).
    return this.payments.startPayment(existing, existing.gateway);
  }
}
```

Then pass `idempotencyKey` down to `orders.createPending` so the column gets set.

**Payload comparison** — compare (sorted `courseIds`, `couponCode`, `gateway`, `referralCode`, `regionCode`). Mismatch → 409 `Conflict`: `"idempotency key reused with different payload"`.

### 1.5 Repository

`apps/api/src/modules/commerce/orders.repository.ts:39`

Add:

```ts
findOrderByIdempotencyKey(userId: string, key: string) {
  return this.prisma.order.findUnique({
    where: { user_idempotency_key: { userId, idempotencyKey: key } },
    include: { items: true },
  });
}
```

Extend `createOrder` args to accept `idempotencyKey`. Wrap the insert in a try/catch on `P2002` — if two requests race past the `findUnique`, the loser retries the lookup and returns the winner's order.

### 1.6 Web client — send the header

`apps/web/lib/api/endpoints.ts:152`

```ts
checkoutSession: (body: CheckoutSessionInput, idempotencyKey: string) =>
  apiFetch<CheckoutSessionDto>("/checkout/session", {
    method: "POST",
    body,
    headers: { "Idempotency-Key": idempotencyKey },
  }),
```

Verify `apiFetch` merges `headers` into the outgoing request (grep `apps/web/lib/api/fetch.ts`).

`apps/web/app/(storefront)/checkout/page.tsx:82` (`pay()`)

```ts
const idempotencyKey = useMemo(
  () => `co_${ulid()}`,
  // Rotate the key when the cart shape changes; retries within the same
  // cart reuse it so the server collapses them onto one order.
  [cart.join(","), coupon, method, regionCode],
);
```

Pass to `api.checkoutSession(body, idempotencyKey)`. Use `ulid` (already a dep for lesson resources — verify).

---

## Step 2 — Provider-side idempotency

Provider keys derived from `order.id` (stable, unique-per-order, safe to re-send on our own retry).

### 2.1 Stripe

`apps/api/src/modules/payment/gateways/stripe/stripe.gateway.ts:44`

```ts
const session = await stripe.checkout.sessions.create(
  {
    mode: "payment",
    // …existing…
  },
  { idempotencyKey: `co_session_${order.id}` },
);
```

Second call with same order.id returns the same session object — Stripe caches responses for 24h. Refund path (`refund()`, line 65) similarly needs `{ idempotencyKey: \`refund_${order.id}\` }`.

### 2.2 PayPal

`apps/api/src/modules/payment/gateways/paypal/paypal.gateway.ts:75`

PayPal REST uses the `PayPal-Request-Id` header on `POST /v2/checkout/orders`. Add it to the fetch/HTTP call:

```ts
headers: {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "PayPal-Request-Id": `co_order_${order.id}`,
},
```

PayPal treats a repeated `PayPal-Request-Id` as a duplicate and returns the same order.

### 2.3 SSLCommerz

`apps/api/src/modules/payment/gateways/sslcommerz/sslcommerz.gateway.ts:99`

SSLCommerz has no idempotency header. Mitigate via `tran_id = order.id` (already unique) AND — before calling their `session` endpoint — check `order.providerRef`. If set, return the cached redirect URL from the DB instead of re-hitting SSLCommerz:

```ts
if (order.providerRef) {
  // Stored on the order after the first successful session start (see
  // payments.service.ts:62).
  return { redirectUrl: cachedRedirectFromRef(order.providerRef), providerRef: order.providerRef };
}
```

Only viable if we also persist `redirectUrl` on the order — add `providerRedirectUrl String?` to `Order`, or accept that SSLCommerz replays create a new session (acceptable: their `tran_id` collision will fail the second attempt).

Decision: **persist `providerRedirectUrl`** so all three gateways behave the same on replay.

`apps/api/src/modules/payment/payments.service.ts:62` — extend `updateOrderProviderRef` to also store `redirectUrl`. Return the cached URL from `startPayment` if the order already has one AND status is still PENDING.

---

## Step 3 — Client double-submit guard

Belt-and-suspenders. Reduces server load; catches the millisecond gap between click and network fire.

`apps/web/app/(storefront)/checkout/page.tsx:82`

Already sets `setProcessing(true)`. Verify the Pay button uses `disabled={processing}` — grep the JSX. If not, wire it. Reset only in the catch branch AND on unmount; do **not** reset in the success branch (page is about to navigate away).

Additional guard against React StrictMode / double-invoke:

```ts
const inFlightKey = useRef<string | null>(null);
async function pay() {
  if (inFlightKey.current === idempotencyKey) return;
  inFlightKey.current = idempotencyKey;
  try {
    // …existing pay flow…
  } finally {
    inFlightKey.current = null;
  }
}
```

---

## Rollout order

1. Ship step 1 (DB + server + client header) — behind no flag, header optional. Old clients still work; new clients get idempotent orders.
2. Ship step 2 (provider keys) — no client change needed.
3. Ship step 3 (button guard + in-flight ref) — pure frontend, no backend risk.
4. After 1 week of clean logs: make the `Idempotency-Key` header required (400 if missing).

---

## Testing

### Unit (`apps/api/src/modules/commerce/checkout.service.spec.ts` — new)

- Two concurrent `createSession` calls with the same key → one `Order` row, both return same `orderId`.
- Same key + different `courseIds` → 409.
- Same key after `PAID` → returns success URL, does not re-hit gateway.
- Missing key → works, creates order (backwards compat).

### Integration (`apps/api/test/e2e.mjs`)

- POST /checkout/session twice with same header → single order in DB (query by `idempotencyKey`).
- POST twice with same header + different cart → second call returns 409.

### Stripe (manual, staging)

- Trigger `startPayment` twice with same order → single Stripe session id.
- Force webhook retry via Stripe CLI (`stripe events resend`) → `WebhookEvent` unique constraint rejects; order still PAID.

### Client (Playwright, `apps/web/tests/checkout.spec.ts` — new or extend)

- Rage-click Pay button 5× → single network request fires (assert with route interception).

---

## Files touched

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma:489` | +`idempotencyKey` + `@@unique([userId, idempotencyKey])` + `providerRedirectUrl` |
| `apps/api/prisma/migrations/*_order_idempotency_key/` | new migration |
| `apps/api/src/modules/commerce/checkout.controller.ts:59` | accept `Idempotency-Key` header |
| `apps/api/src/modules/commerce/checkout.service.ts:102` | lookup-by-key + payload guard, pass key to createPending |
| `apps/api/src/modules/commerce/orders.repository.ts:39` | `findOrderByIdempotencyKey`, extend `createOrder`, store `providerRedirectUrl` |
| `apps/api/src/modules/commerce/orders.service.ts:64` | thread `idempotencyKey` through `createPending` |
| `apps/api/src/modules/payment/payments.service.ts:41` | short-circuit if `providerRedirectUrl` cached; persist redirect on first call |
| `apps/api/src/modules/payment/gateways/stripe/stripe.gateway.ts:44,65` | pass `{ idempotencyKey }` to `sessions.create` and `refunds.create` |
| `apps/api/src/modules/payment/gateways/paypal/paypal.gateway.ts:75` | `PayPal-Request-Id` header |
| `apps/api/src/modules/payment/gateways/sslcommerz/sslcommerz.gateway.ts:99` | return cached redirect on replay |
| `apps/web/lib/api/endpoints.ts:152` | second arg `idempotencyKey`; send header |
| `apps/web/app/(storefront)/checkout/page.tsx:82` | generate ULID key, pass to endpoint, in-flight ref guard |

---

## Non-goals

- Distributed lock on cart during checkout (concurrent checkout from two devices is rare + covered by the payload guard).
- Payment/OrderStatus state machine refactor (out of scope; today's PENDING → PAID/FAILED works).
- Retrying failed webhook processing (already handled by provider retry policy).
