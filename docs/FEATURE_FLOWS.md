# SkillStream — Feature & Role Flows (Start to End)

> Companion to [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) (architecture, diagrams,
> data model). This document walks through **every role and every feature** as a
> step-by-step flow — user action → frontend → API endpoint → database effect →
> side effects (emails, webhooks, jobs) — so a new developer can answer "how does
> X actually work?" without reverse-engineering the code.
>
> Stack: NestJS API (`apps/api/src`) + Next.js 16 web app (`apps/web/app`),
> PostgreSQL via Prisma, Redis/BullMQ for background jobs, Cloudflare Stream for
> video, Stripe/PayPal for payment, Resend for email.

---

## 0. The five roles

`User.role` (Prisma `UserRole` enum): `STUDENT`, `INSTRUCTOR`, `ADMIN`,
`DELIVERY_PARTNER`, `ORG_ADMIN`.

- **Every account starts as `STUDENT` at signup.** There is no role picker at
  registration. All other roles are *granted* by an approval or claim workflow —
  never chosen by the user directly:
  - `INSTRUCTOR` — admin approves an `InstructorApplication`.
  - `DELIVERY_PARTNER` — admin approves a `DeliveryPartnerApplication`.
  - `ORG_ADMIN` — user claims an org invite whose invited role is `ADMIN`.
  - `ADMIN` — not self-serve at all; set directly in the database (seed/ops task).
- **Authorization is enforced twice, asymmetrically:**
  - **API (authoritative):** `apps/api/src/app.module.ts` registers `JwtAuthGuard`
    → `RolesGuard` → `ThrottlerGuard` globally. Every route requires a valid JWT
    unless marked `@Public()`; `@Roles("ADMIN", ...)` further restricts by role.
    Delivery-partner and org-admin actions are **not** gated by `@Roles` at all —
    they're checked inline in the service (`payeeContext()`,
    `assertOrgAdmin()`), because those roles are contextual (an org admin is
    only "admin" *within their own org*).
  - **Web app (UX only, not security):** `apps/web/proxy.ts` (Next.js 16's
    renamed middleware) redirects unauthenticated visitors to `/login` for
    protected prefixes, and — only for `/admin` and `/instructor` — decodes
    (without verifying signature) the JWT's `role` claim to bounce a
    mismatched role to their own portal home. It explicitly does **not**
    gate `/delivery-partner`, since any logged-in user visits it to submit the
    partner application. Real enforcement always happens server-side.

| Role | Portal home | Web prefix |
|---|---|---|
| `ADMIN` | `/admin` | `/admin/*` (also allowed into `/instructor/*`, treated as superuser) |
| `INSTRUCTOR` | `/instructor` | `/instructor/*` |
| `DELIVERY_PARTNER` | `/delivery-partner` | `/delivery-partner/*` (open to any role, since it also hosts the apply form) |
| `ORG_ADMIN` | `/dashboard` | `/org/[slug]/*` (org-admin only within that org) |
| `STUDENT` | `/dashboard` | `/dashboard/*`, `/account`, `/learn/*` |

---

## 1. Authentication (applies to every role)

### 1.1 Register
1. `/signup` — name, email, password (no role field), plus an invisible
   `referralCode` carried from `?ref=CODE` if the visitor arrived via a
   delivery partner's link (see §2.2).
2. `POST /auth/register` (rate-limited 5/min) → `AuthService.register`:
   rejects duplicate email, hashes password with **argon2id**, creates `User`
   with `role: STUDENT` + an empty `StudentProfile`. If `referralCode`
   resolves to an `APPROVED` partner, sets `User.referredByPartnerId` —
   durable, locked in for life, never touched again even if the same person
   later clicks a different partner's link. An unknown/invalid code is
   silently ignored; it never blocks signup.
3. Fires `EmailService.sendWelcome()` **non-blocking** — a failure here never
   blocks signup.
4. Issues an access + refresh token pair (see 1.4), sets httpOnly cookies,
   redirects to `?next=` or `/dashboard`.
5. **There is no email verification anywhere in the codebase** — `emailVerified`
   exists on the DTO but nothing ever sets or checks it.

### 1.2 Login
1. `/login` → `POST /auth/login` (rate-limited 8/min).
2. If the email isn't found, the password is still checked against a **dummy
   argon2 hash** to keep response timing constant (prevents user enumeration
   via timing).
3. On success: issues tokens, then frontend calls `GET /auth/me` and redirects
   by role (`ADMIN→/admin`, `INSTRUCTOR→/instructor`, `DELIVERY_PARTNER→/delivery-partner`,
   `ORG_ADMIN→/org`, else `/dashboard`) — unless a `?next=` param says otherwise
   (used by the org-invite-claim flow). A `STUDENT` with a `PENDING`
   instructor or delivery-partner application (role hasn't changed yet — see
   §4.1/§5.1) is redirected to `/instructor` or `/delivery-partner` instead of
   `/dashboard`, and the student layout itself refuses to render for a
   `PENDING` delivery-partner applicant even on direct navigation — a pending
   applicant isn't a student in the meantime, full stop.

### 1.3 Logout
`POST /auth/logout` deletes the refresh-token DB row (hard delete, not just
expiry) and clears both cookies.

### 1.4 Token mechanics
- **Access token**: real JWT (`{sub, email, role}`), 15 min default TTL,
  delivered as an httpOnly cookie *and* in the JSON body (for API clients).
  Every request re-fetches the user from the DB — a deleted user's still-valid
  JWT is rejected immediately.
- **Refresh token**: an *opaque* random token (not a JWT); only its SHA-256
  hash is stored (`RefreshToken` table).
- **Rotation + theft detection**: refreshing is single-use — the old token is
  revoked and a new one issued atomically. If a *already-revoked* token is
  replayed after a 60-second grace window (covers benign double-tab races),
  it's treated as stolen and **every live session for that user is revoked**.

### 1.5 Password reset
1. `POST /auth/forgot-password` always returns `{ok:true}` regardless of
   whether the account exists (prevents email enumeration).
2. If found, a single-use opaque token is emailed
   (`EmailService.sendPasswordReset`), 1-hour TTL, claimed atomically
   (no double-use race).
3. `POST /auth/reset-password` sets the new password and **deletes every
   refresh token for that user** — forces re-login on all devices.
4. In-session `POST /auth/me/password` requires the current password and does
   *not* revoke other sessions.

---

## 2. Public storefront & checkout (guest → paying student)

### 2.1 Browsing & cart
- Course catalog and detail pages (`/courses`, `/courses/[slug]`) are public,
  no auth required.
- The cart is **entirely client-side** (a Zustand-like context, `store.tsx`) —
  just an array of course IDs. Nothing is written server-side until checkout.

### 2.2 Referral capture (delivery partner attribution)
If a visitor arrives via `?ref=CODE` (a delivery partner's link), the code is
captured client-side and persisted in `localStorage`
(`skillstream_ref_v1`) — this survives navigation and is attached at checkout.
**Two attribution paths, in priority order:**
1. **Durable, signup-time** — if the code was present when the visitor
   created their account, it's locked into `User.referredByPartnerId`
   forever (§1.1). This is the one that actually matters for "who gets
   credit" and survives a different device, a cleared browser, or a
   purchase made weeks later.
2. **Checkout-time fallback** — the `localStorage` code is still read and
   sent with checkout (§2.4), but only used if the buyer has no durable
   attribution (e.g. an account that predates this field). It can never
   override an existing durable attribution — a customer can't be silently
   re-attributed to a different partner by a later link click.

See §5 for the full partner-commission flow.

### 2.3 Price quote (PPP + coupons + partner campaigns)
1. `POST /checkout/quote` (authenticated) — resolves the buyer's pricing
   region and applies a **regional/PPP multiplier** to each course's base
   price, then validates and applies a coupon code if present (active,
   unexpired, under its usage cap, meets minimum spend, correctly scoped to
   global or a specific course).
2. **`campaignCode`** is a second, mutually exclusive discount input — a
   delivery-partner campaign code (§5.5) instead of a coupon. The cart/
   checkout UI enforces "one or the other" by construction (applying one
   clears the other), and `CheckoutService.quote` rejects a request that
   somehow sends both. Unlike a coupon, a valid campaign code also drives
   commission attribution at session-creation time (§2.4, §5.5) — it isn't
   just a price adjustment.
3. This is **the authoritative price** — the client only ever displays what
   the server computed; nothing client-supplied is trusted.

### 2.4 Checkout session
1. On "Pay", an unauthenticated user is bounced to `/login?next=/checkout`
   first — an order must be attributed to a real user.
2. `POST /checkout/session` — server re-validates a gateway kill-switch
   (`PlatformSettings.stripeEnabled`/`paypalEnabled`, checked server-side, not
   just hidden in the UI), filters out courses already owned, **recomputes the
   quote again** (never trusts the client), creates a `PENDING` `Order` +
   `OrderItem` rows with price *snapshots* (so later price changes don't
   retroactively alter historical orders).
3. Resolves referral attribution — **a valid `campaignCode` takes priority
   over everything else** (§5.5), then durable signup-time attribution, then
   the checkout-supplied `referralCode` as a last fallback (§2.2) — and, if it
   resolves to an `APPROVED` partner, stamps a `PENDING` `DeliveryPartnerReferral`
   onto the order (commission isn't credited yet — only on payment).
4. **Free path** (100%-off coupon or free course): fulfilled immediately, no
   gateway involved, straight to the success page.
5. **Paid path**: hands off to Stripe Checkout or PayPal Orders v2 depending
   on the chosen gateway. If neither is configured, production throws; in
   dev/local a `devSimulateToken` lets the flow be exercised without live
   credentials.

### 2.5 Payment confirmation → fulfillment
1. Stripe/PayPal deliver a signed webhook (`POST /webhooks/stripe`,
   `POST /webhooks/paypal`) — both public but cryptographically verified
   (Stripe signature check) or idempotency-deduped by event ID (PayPal),
   *not* protected by JWT auth.
2. `OrdersService.fulfill()` is **the single source of truth for granting
   access** — idempotent, and in one transaction:
   - Marks the order `PAID`.
   - Creates `Enrollment` rows for every purchased course (idempotent upsert).
   - Increments per-course revenue and the owning instructor's lifetime
     earnings (this is what feeds the instructor payout pool — §4.3).
   - Increments the buyer's lifetime spend.
   - Records coupon redemption if one was used.
   - Confirms the pending delivery-partner referral, crediting commission — only
     now, never at order-creation, so abandoned checkouts never pay commission.
3. **No purchase-confirmation email is sent** — the email service only has
   welcome / password-reset / org-invite / reminder templates. This is a real
   gap worth knowing about, not a documentation omission.
4. The success page (`/checkout/success?order=<id>`) polls `GET /me/orders`
   every 2s until the order reads `PAID`, since webhook delivery can lag a
   moment behind the browser redirect.

### 2.6 Refunds (admin-triggered — see §7.10)

---

## 3. Student flow (post-purchase)

### 3.1 Dashboard & billing
`/dashboard` shows purchased courses and progress; `/dashboard/billing` lists
orders (`GET /me/orders`) with status badges (`PAID`/`REFUNDED`/`FAILED`/`PENDING`)
and a per-order **receipt PDF** (`GET /me/orders/:id/receipt` — own orders only,
settled orders only, rendered on the fly). The page holds no card on file:
Stripe/PayPal collect payment details on their own hosted page.

### 3.2 Learning a course (`/learn/[slug]`)
1. Loads full course detail (sections + lessons — unlike the lightweight
   catalog summary) and guards against an empty curriculum before mounting
   the player.
2. **Marking a lesson complete**: toggles a `LessonProgress` row (requires an
   actual enrollment). Every toggle recomputes the enrollment's overall
   status (`IN_PROGRESS`/`COMPLETED`) and, **when the course reaches 100%,
   automatically issues a `Certificate`** with a generated serial — no
   separate "request certificate" step. If progress later drops below 100%
   (a lesson is un-toggled), the certificate is deleted again.
3. **Resources tab**: each lesson can carry attachments (`Lesson.resources`,
   validated `{name, url, sizeLabel?}` — the platform hosts video but no
   files, so a resource is a link the instructor owns). Authors add them in
   the course builder; unparseable rows in the JSON column are dropped on read
   rather than served.
4. **Notes tab**: per-lesson notes on the `LessonNote` table
   (`GET`/`PUT /me/lessons/:lessonId/note`, one row per user+lesson). Writing
   requires an enrollment — otherwise the table is free storage for anyone with
   an account — and an empty body deletes the note rather than storing a blank.
   The UI debounces to one PUT ~800ms after typing stops.

### 3.3 Quizzes
1. Fetching quiz questions strips the correct answers from the payload before
   they ever reach the browser.
2. `POST /lessons/:lessonId/quiz/attempt` grades server-side, tracks
   `bestScore`/`lastScore`/`attempts` plus an immutable per-attempt audit log.
3. **On pass**, the quiz's lesson is auto-marked complete — same
   completion/certificate logic as manual toggling.

### 3.4 Certificates
`/dashboard/certificates` simply lists whatever `Certificate` rows already
exist for the student (issued automatically per §3.2, never requested).
`CertificateDto.pdfUrl` points at `GET /certificates/:serial/pdf`, which
renders the certificate on demand (no file is stored). The serial is 48 bits of
randomness and doubles as the credential for two **public** endpoints:
`GET /certificates/:serial` (verification: learner name, course, issue date —
nothing else about the account) and the PDF itself, both rate-limited to 20/min
so serials can't be enumerated. `/verify/[serial]` is the public page behind
them, and Share now links there instead of the private dashboard.

### 3.5 Progress
`/dashboard/progress` is driven by real `LessonProgress` completions from the
last 7 days (durations summed per day) — not a stored counter, so it can't
drift from reality.

### 3.6 Reviews & comments
- **Reviews** require enrollment to write. Every write (including edits)
  resets status to `PENDING` and goes back through admin moderation before it
  affects the public rating — see §6.13.
- **Comments** (course Q&A) only require being logged in — **no enrollment
  check and no moderation gate**. Any authenticated user of any role can
  comment on any course page without having purchased it. This is a
  deliberate, documented design choice in the code, not an oversight — but
  worth flagging since it's easy to assume otherwise.

### 3.7 Account settings
`/account` — profile (name, ISO-3166 country code, avatar URL) and password
changes, no role restriction beyond "it's your own account." There is no image
hosting on the platform (Cloudflare Stream is video only), so the avatar is a
URL you already host, saved through the existing `PATCH /auth/me/profile`.
`phone` (E.164, validated) is the delivery target for SMS reminders; without
one those reminders are skipped rather than queued forever. Notification
preferences are server-side: `GET`/`PATCH /me/notification-preferences` persist
to `StudentProfile.notificationPrefs`, keyed by the real `ReminderTrigger`
values, and **`NotificationsProcessor` checks them before every send** — an
opt-out genuinely stops the message.

---

## 4. Instructor flow

### 4.1 Becoming an instructor
1. Any logged-in user (of any role) can submit an application at `/teach`
   (headline, expertise, bio, optional portfolio link) → creates a `PENDING`
   `InstructorApplication`. Re-applying is blocked only while a `PENDING`
   application already exists — a rejected applicant can re-apply.
2. **Admin approves or rejects** (only path — no peer/auto-approval):
   - **Approve**: promotes `User.role → INSTRUCTOR` and creates/updates an
     `InstructorProfile` (`status: APPROVED`), all in one transaction.
   - **Reject**: only the application status changes.
3. The instructor portal is gated client-side by an `ApprovalGate` component
   that reads the applicant's current status and shows the right message
   ("not an instructor yet" / "under review" / "not approved, re-apply") —
   but the *real* enforcement is server-side: authoring endpoints require
   `@Roles("INSTRUCTOR","ADMIN")`, which only lets in users whose role was
   actually flipped by an admin approval. Approving or rejecting an application
   emails the applicant (`EmailService.sendApplicationDecision`, fire-and-forget
   so a delivery failure can't undo the decision). Same for delivery partners (§5.1).

### 4.2 Authoring a course
Every authoring endpoint additionally checks course ownership
(`course.instructorId === user.id`, or caller is `ADMIN`) — an instructor can
only ever touch their own courses.

1. **Create/edit metadata**: title, subtitle, category, level, description,
   price, thumbnail (downsized client-side), sections and lessons — all
   through the same course-builder UI used for both "new" and "edit."
   Sections reorder by dragging their grip handle; the new order is written as
   each section's `order` on save.
2. **Lesson types** (`LessonType`): `VIDEO`, `ARTICLE`, `QUIZ`.
   - **Video**: the builder requests a tus upload reservation from the API
     (`POST /media/tus`), then the browser uploads the raw file **straight to
     Cloudflare** via tus-js-client, bypassing the SkillStream API for the byte
     transfer entirely. After bytes complete, the client calls
     `POST /media/uploads/:id/complete`; playback later signs a short-lived
     (2hr) HLS/iframe URL, and checks enrollment first unless the lesson is
     flagged as a free preview.
   - **Article**: plain/rich text stored directly on the lesson row.
   - **Resources**: any lesson type can carry downloadable links (see §3.2).
   - **Quiz**: a 1:1 `Quiz` with nested `QuizQuestion`/`QuizOption` rows;
     editing a question's options **replaces all of them**, it doesn't diff.
3. **Publishing** (`DRAFT → REVIEW → PUBLISHED`): the shipped instructor UI
   only exposes "Save draft" and "Submit for review" buttons — there's no
   direct "Publish" button for instructors. An admin opens the course in the
   *admin* course builder and flips a "Publish" toggle to move it live. **Note
   for developers**: the API itself does not hard-block an instructor from
   setting `PUBLISHED` directly (the endpoint only checks ownership, not which
   status transitions are legal) — the review step is enforced by UI
   convention, not a server-side rule.
4. **First publish** sets `publishedAt` and bumps the instructor's course
   count exactly once (re-publishing doesn't double-count).

### 4.3 Profile & earnings
- `/instructor/profile` — editable even before approval, so applicants can
  fill it out while waiting.
- **Earnings** are tracked as `InstructorProfile.earningsCents`, a lifetime
  counter incremented *only* by `OrdersService.fulfill()` (§2.5) — the
  instructor gets the full item price; there's no platform commission cut
  modeled in these tables.
- `/instructor/earnings` shows lifetime stats plus a per-course revenue
  breakdown, and embeds the shared payout panel (§4.4).

### 4.4 Payout request → approve → paid
This ledger is **shared infrastructure** between instructors and sales
partners (`PayeeType`: `INSTRUCTOR` | `DELIVERY_PARTNER`) — see the unified writeup in
§7 (admin payouts), which covers the full lifecycle. From the instructor
side:
1. Set a payout destination (PayPal email or bank details — free text, read
   manually by an admin; **the platform does not move money itself**).
2. Available balance = lifetime earned − already paid − currently in flight
   (requested/approved but not yet paid).
3. Request a payout for the *entire* available balance once it's at least
   **$50** — one open request at a time.
4. Admin approves → marks paid (or rejects, releasing the hold).

---

## 5. Delivery partner flow

A delivery partner does two independent things once approved: **earns
referral commission** on purchases they drive (§5.2 — this is the original,
still-unchanged mechanism), and, separately, **redistributes specific
assigned courses to invited members for free** (§5.4 — an additive feature
layered on top, not a replacement).

### 5.1 Becoming a partner
1. **Only a brand-new visitor (no existing account) can apply** — the
   `/partner` page's combined signup+apply form (name, email, password,
   country, optional custom fields, optional documents, and an optional
   *expected* commission rate the applicant is requesting) creates the
   account and the `PENDING` `DeliveryPartnerApplication` in one step.
   An already-logged-in user of any role sees a read-only explanation
   instead of a form — there is no standalone "apply" endpoint any more, by
   design: the old approval step did an unconditional `role` overwrite, so
   an existing `INSTRUCTOR`/`ORG_ADMIN` applying could silently lose their
   other identity. Restricting applications to fresh accounts closes that
   off entirely.
2. Submission fires a dedicated **"application submitted" confirmation
   email** — not the generic student welcome email, which is what this used
   to (incorrectly) send.
3. While `PENDING`, the account's `role` stays `STUDENT` (mirrors the
   instructor pattern — no separate "applicant" role), but it does **not**
   get to use the student dashboard: `/dashboard` and `/account` both
   redirect a pending applicant to `/delivery-partner`'s status page instead
   of rendering, and `destinationFor()` sends them straight there right after
   login too (§1.2). A pending applicant is not a student in the meantime.
4. Admin reviews from `/admin/delivery-partners` (Applications tab) — the
   approve dialog defaults the commission-% field to whatever the applicant
   requested (visible on the application detail view too), but the admin
   sets the actual approved rate:
   - **Approve**: promotes `User.role → DELIVERY_PARTNER`, upserts a
     `DeliveryPartner` row with a freshly generated referral code, and sends
     both an in-app notification and an email.
   - **Reject**: no self-service reapply (a deliberate divergence from the
     instructor flow) — the applicant sees a rejection notice pointing to
     support and simply continues as an ordinary student.
   - **Suspend/Reinstate** (on an already-approved partner): every
     self-service partner action — inviting/managing members, listing course
     assignments — is re-checked server-side against `status === APPROVED`,
     not just hidden in the UI, so a suspended partner's dashboard access is
     actually revoked, not just cosmetically hidden.

### 5.2 Referral link → commission
1. The partner's referral link is just `{origin}/?ref=<code>` — no separate
   link-shortening service.
2. A visitor's `?ref=` code is captured client-side; **attribution is
   resolved with durable signup-time attribution taking priority over the
   checkout-time code** — see §2.2 for the full precedence rule and why it
   exists (cross-device/delayed-purchase attribution used to silently break
   under the old localStorage-only scheme).
3. At checkout, resolving to an `APPROVED` partner creates a `PENDING`
   `DeliveryPartnerReferral` with the commission amount pre-computed
   (`order total × partner's commission%`). A code/attribution belonging to
   a non-`APPROVED` partner (suspended/rejected) silently fails to
   attribute — no error is shown to the buyer.
4. **Only on payment confirmation** does the referral flip to `CONFIRMED`
   and the commission get added to the partner's pending/lifetime earnings —
   an abandoned or failed checkout never pays out.
5. **Refunding the order reverses the commission proportionally** — a 50%
   refund reverses 50% of that order's commission, mirroring how instructor
   earnings are already prorated on refund (§7.10). A `CONFIRMED`
   commission's reversal comes off pending+lifetime earnings; a `PAID`
   commission's reversal only comes off lifetime earnings (never
   `paidEarningsCents` — that money genuinely was sent), which surfaces as
   an automatic clawback against the partner's *next* payout via the normal
   `available = lifetimeEarned − paidOut − inFlight` balance math (§7.12),
   not a separate reconciliation step. `DeliveryPartnerReferral.status` is a
   real enum — `PENDING | CONFIRMED | PAID | REVERSED` — with a
   `reversedCents` counter so several partial refunds on the same order
   never reverse more than was actually earned.
6. The partner's `/delivery-partner/referrals` and `/delivery-partner/earnings`
   pages show every referral with its status, and a separate "Reversed
   commissions" table once any exist.

### 5.3 Payout
Identical request → approve → paid lifecycle as instructors (§4.4, §7), using
`PayeeType: DELIVERY_PARTNER` and `DeliveryPartner.totalEarningsCents` as the earnings pool.
One implementation detail worth knowing: when an admin marks a partner payout
paid, the system bulk-flips *all* of that partner's currently-`CONFIRMED`
referrals to `PAID` — not just the ones that funded this specific payout — so
if new commissions confirm between "request" and "mark paid," they get swept
into the same paid-mark even though they weren't part of the requested amount.

### 5.4 Course assignment & member invites (additive, per-course)
Full design history and decisions in
[`DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md`](./DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md).
Separate from referral commission — an admin can assign specific *published*
courses (any visibility, not just PRIVATE) to a partner with a per-course
member cap (mirrors `Organization.seatCount`, default 10, via
`ManagePartnerCoursesDialog` on `/admin/delivery-partners`). The partner then
sees those courses at `/delivery-partner/courses` and can invite members
(email invite, 7-day token, cap-enforced) to redistribute free access to one
specific assigned course — access is per-course-assignment, not "membership
in the partner's network" in the abstract. An invited member stays a normal
`STUDENT`; they claim via `/join/partner/[token]` (a separate route from the
org claim page, `/join/[token]`, sharing the same `InviteClaimShell` state
machine but with its own copy/icon/redirect) and their granted courses show
up at `/dashboard/partner-courses` — deliberately not folded into
`/dashboard/team`, since a partner grant is a capped, per-course seat, not a
B2B "team" relationship. A member's access pauses if their partner is later
suspended, same semantics as an org's grace-period lock. Free self-enrollment
(`enrollFree`) and lesson-playback gating both check this grant regardless of
the course's visibility or price — an admin can assign a `PUBLIC`, paid
course to a partner, and a member's free access must still work even though
the course isn't `PRIVATE`.

### 5.5 Campaign codes (discount + commission, admin-created)
A campaign is a hybrid of a coupon (discounts the buyer) and a referral
(credits the partner) — admin-only to create, for one `APPROVED` partner at a
time, applicable to **all courses** (global, unlike course-scoped `Coupon`).

1. **Admin creates a campaign** for a partner (`ManagePartnerCampaignDialog`
   on `/admin/delivery-partners` → Partners tab): a discount % (1–100), a
   start/end date window, and an optional redemption cap (0 = unlimited). A
   fresh code is generated (`CMP-XXXXXX`) — distinct from the partner's
   `referralCode`, since a campaign is a separate, time-boxed thing, not the
   partner's permanent link code. **At most one currently-usable
   (active/scheduled/limit-reached) campaign per partner at a time** — the
   server rejects a new campaign whose date range overlaps another active one
   for the same partner; the admin dialog reflects this by hiding the create
   form while one exists, showing a "Deactivate" action instead.
2. **The partner sees their code** on `/delivery-partner` (Overview) only
   while a campaign is active or scheduled — a banner with the code, discount
   %, days remaining, and a redemption meter if a cap is set. Nothing renders
   there for a partner with no campaign.
3. **At checkout**, the buyer enters the code in the cart's "Partner code"
   field (mutually exclusive with Coupon — §2.3). A valid code:
   - Discounts the whole cart by the campaign's percentage (`partner-campaign.ts`,
     shared between API and web for consistent preview/authoritative pricing).
   - Takes priority over both durable signup-time attribution *and* the
     checkout-supplied `referralCode` for this order's commission — typing an
     explicit code is a stronger signal than passive attribution
     (`DeliveryPartnerService.resolveReferralPartner`).
   - Is rejected with a clear message if disabled, outside its date window,
     the redemption cap is reached, or the owning partner is no longer
     `APPROVED` (a suspended partner's campaign stops working immediately).
4. **Commission is computed on the discounted total**, at the partner's own
   standing `commissionPercent` — same formula as a plain referral, no
   separate campaign-specific rate. The resulting `DeliveryPartnerReferral`
   row is created and confirmed through the **exact same PENDING → CONFIRMED
   pipeline as §5.2** — a campaign-driven referral is not a parallel system,
   just a different way to resolve which partner gets credited.
5. **Redemption count only increments on payment confirmation** (`orders.fulfill`),
   never at checkout-session creation — an abandoned cart never consumes a
   capped campaign's seats.
6. **Refunding a campaign-driven order reverses commission proportionally**
   through the same mechanism as §5.2/§7.10 — no campaign-specific refund
   code exists; reusing `DeliveryPartnerReferral` end-to-end means refund
   reversal, payout aggregation, and the partner's Referrals/Earnings pages
   all already handle it correctly.
7. The admin Orders table (§7.10) surfaces a campaign-discounted order's code
   the same way it surfaces a coupon's (a badge in the "Discount code"
   column), and the orders search box matches campaign codes too.

---

## 6. Organization (B2B) flow

Two in-org roles only: `ADMIN` and `MEMBER` (no "manager" tier). Org accounts
themselves are **entirely platform-admin-provisioned** — there is no
self-service org signup or bulk seat-purchase flow. The org's own account page
literally says "contact your account manager" to buy more seats.

### 6.1 Org creation
Platform admin creates the org (`/admin/organizations`): name, slug, domain,
admin email, seat count. Starts in `TRIAL` status.

### 6.2 Inviting members
1. An org admin (or platform admin) invites by email + role from
   `/org/[slug]/members`. Blocked if the org has no seats left.
2. Creates a 7-day-expiring invitation token and emails a join link
   (non-blocking — a failed send doesn't fail the request; in dev without
   email configured, the link is just logged to the console).

### 6.3 Claiming an invite
1. Visiting `/join/[token]` shows the invite (org name, role, email) whether
   or not the visitor is logged in; expired/already-claimed tokens show an
   error with no auto-retry.
2. If signed in, the invite auto-claims on page load. This upserts an
   `OrgMember` row **keyed to the authenticated user's actual account email**
   — worth knowing that if someone accepts using a different login than the
   address that was invited, the membership still attaches to whichever
   account they're actually signed in as.
3. Increments the org's used-seat count; if the invited role was `ADMIN`,
   also promotes `User.role → ORG_ADMIN` platform-wide (the *only* place this
   role is ever assigned).
4. Redirects admins to `/org/[slug]`, regular members to `/dashboard/team`.

### 6.4 Org admin dashboard (`/org/[slug]/*`)
Gated to org admins (or platform admin) only — a plain member gets a 403 and
never sees this portal, using `/dashboard/team` instead.
- **Courses**: assign/unassign private courses to the org (flips course
  visibility between `PUBLIC` and `PRIVATE`).
- **Members**: invite, list pending invitations, cancel invitations, remove
  members — blocked from removing the org's *last* remaining admin (so an org
  can never end up admin-less via the API; the UI is even stricter and hides
  the remove button for any admin row).
- **Account**: read-only seat usage and org profile.

### 6.5 Member course access
Org-private courses are **not** auto-enrolled on joining — it's a separate,
self-serve step. A member browses their org's assigned courses at
`/dashboard/team` and clicks "Enroll," which grants access directly (no
payment/order involved — seats are pre-paid at the org level) provided
they're a genuine member of the owning org.

---

## 7. Platform admin flow (`/admin/*`)

Every admin route requires `@Roles("ADMIN")` server-side; **the web app itself
has no client-side admin gate** — a non-admin visiting `/admin` sees the shell
render, but every API call underneath 401s/403s. Enforcement is 100% server-side.

### 7.1 Overview
`/admin` — revenue, enrollments, students, instructors, published-course
counts, refund rate, a 14-day trend, and a recent-activity feed. Pure
reporting, no writes.

### 7.2 Organizations
Create + list orgs (see §6.1), plus a **Plan** dialog for the two fields only
SkillStream may change — `seatCount` and `status`. `OrganizationsService.update`
enforces that split server-side: an org admin editing their own org can change
name/domain/logo (wired on `/org/[slug]/account`) but gets a 403 for seats or
status, so a customer can't grant themselves seats or lift a suspension.
Day-to-day org management (invites, member removal, course assignment) is
self-served by org admins.

### 7.3 Settings
A single `PlatformSettings` row (upserted, so it always exists): platform
name, support email, base currency, default language, and **gateway
kill-switches** — `stripeEnabled`/`paypalEnabled` genuinely block that gateway
at checkout server-side, not just hide a button. The four admin notification
toggles are live too: `newEnrollment` / `newReview` fire as they happen from
`AdminAlertsService`, and `dailyRevenue` / `atRiskDigest` go out from a daily
`admin-digest` job. All of them email the `supportEmail` on this page, and a
toggle that's off sends nothing.

### 7.4 Delivery partners
Two tabs. **Applications**: review pending applications (the approve dialog
defaults commission% to the applicant's requested rate, editable; optional
note; or reject with a reason), search/filter by status. **Partners**: manage
the approved roster — edit commission%, suspend/reinstate (both wired to
`PATCH /admin/delivery-partners/:id`; a redesigned 5-column table replaced an
8-column one that made Suspend hard to find), open **Manage courses** per
partner to assign/unassign published courses with a per-course member cap
(§5.4), and open **Campaign** to create/deactivate that partner's discount +
commission campaign (§5.5). See §5.1.

### 7.5 Instructors
Review pending applications (approve/reject), browse the approved roster. See
§4.1.

### 7.6 Students
Search (debounced, name/email) + paginate the student roster, a stats strip
(total / active / "at risk" — the latter is just `total − active`, not a
separately-tracked state), and a **"Flag at risk"** action that sets the
student's profile status only — it does not touch login or purchasing, and the
button is now labelled for what it does. `DELETE /admin/users/:id` exists but
has no UI: it refuses accounts with orders (accounting records) or authored
courses, and says so, rather than failing on a raw foreign key.

### 7.7 Coupons
`CouponType`: `PERCENT | FIXED | FREE`. `CouponScope`: `GLOBAL | COURSE`.
Create/update by code (upsert), toggle active/featured, delete. Only one
coupon can ever be `featured` at a time — enforced by a database-level
partial unique index, not just application logic, so it can't race.

### 7.8 Courses
Admin can create/edit/publish/delete **any** course using the same builder
instructors use — effectively a super-instructor, not a separate moderation
queue. There's no dedicated "approve this course" review screen; publishing a
`REVIEW`-status course is just flipping its status, same mechanism described
in §4.2.

### 7.9 Marketing / automation
Rule-based reminder emails (`AutomationRule`: trigger like idle / low-progress
/ abandoned-cart / almost-done / new-content, channels email/SMS, a text
template with `{{placeholders}}`). Admins toggle rules on/off and can delete
a rule; **actual sending happens in a background job**, not from the admin action — an hourly
sweep evaluates hard-coded per-trigger thresholds against real user activity,
respects a per-trigger cooldown, and logs every send. Email goes through Resend
and **SMS through Twilio** (`SmsService`, a single form-encoded POST rather than
the SDK); with no provider credentials either channel logs instead of sending,
so local and CI runs need no accounts. The rule's "condition"
field is admin-facing prose only, not a parsed rule language — a known,
intentional simplification.

### 7.10 Orders & refunds
List all orders, searchable by order id, coupon code, **partner campaign
code**, provider ref, buyer, or item title. The "Discount code" column shows
whichever was actually used — a coupon badge, or a campaign badge (§5.5) —
never both, since the two are mutually exclusive at checkout.

**Refund is credit-only — no payment-gateway call is ever made.** One admin
action picks any subset of the order's items with arbitrary per-item dollar
amounts (each capped at that item's remaining refundable), and the student is
made whole entirely via store credit (`StudentCreditLedger`, see
`REFUND_TO_CREDIT_PLAN.md`), applicable toward a future purchase. In the same
transaction it:
- Decrements that course's revenue/student count and the instructor's
  earnings, prorated to the refunded amount.
- Decrements the buyer's lifetime spend.
- **Revokes enrollment only for an item that becomes *fully* refunded** by
  this action (cumulative `refundedCents == priceCents`) — a dollar-partial
  refund on an otherwise-active item leaves access intact.
- **Reverses the delivery-partner commission proportionally**, if the order
  was attributed to one — whether via a plain referral (§5.2) or a campaign
  code (§5.5), both resolve to the same `DeliveryPartnerReferral` row, so this
  one reversal path handles either origin identically. A 50% refund reverses
  50% of that order's commission, capped so several partial refunds never
  reverse more than was actually earned. A commission already paid out is
  clawed back against the partner's *next* payout rather than reversed in
  place.
- Grants the store credit and fires the student notification.

Already-refunded orders (or the already-refunded portion of a
partially-refunded one) can't be refunded twice — the remaining-refundable
amount is checked server-side per item and per order.

### 7.11 Pricing
Regional pricing tiers (a multiplier) and per-country regions (currency, FX
rate, optional per-region override). Editing a tier's multiplier cascades to
every region on that tier that hasn't been manually overridden. A daily
background job refreshes FX rates from a public feed; on failure it keeps the
last known rate rather than guessing — and since checkout always actually
charges in USD, stale FX display is cosmetic, never a mischarging risk.

### 7.12 Payouts — the unified instructor + delivery-partner system
The most involved admin feature; shared ledger for both payee types.

**Model:** `PayoutAccount` (destination on file per user) + `Payout` (one row
per request, with a *snapshot* of the destination at request time so later
account edits don't rewrite history).

**State machine:**
```
REQUESTED --approve--> APPROVED --mark paid--> PAID
REQUESTED ---------------- mark paid (shortcut) --------------> PAID
REQUESTED | APPROVED --reject--> REJECTED  (terminal, releases the balance)
```

1. **Payee requests**: available balance = lifetime earned (instructor's
   lifetime earnings, or partner's lifetime commission) minus everything
   already paid minus everything currently in flight, **floored at 0**. A
   request always asks for the *entire* available balance, must be at least
   $50, and only one request can be open at a time. The floor-at-0 clamp is
   also what makes commission-reversal-on-refund (§7.10) work as a clawback:
   reversing a `PAID` referral only decrements the partner's lifetime-earned
   figure (never what was already paid out), so if that drops below what's
   already been paid, `availableCents` simply reads 0 until new commissions
   earn it back above water — no separate reconciliation step needed.
2. **Admin approves**: pure ledger state change — no money moves, nothing
   else updates (the amount was already counted as "in flight" the moment it
   was requested).
3. **Admin marks paid**: an admin *attestation* that they executed the
   transfer manually outside the platform (the system has no real
   payment-rail integration for payouts — that's a documented, deliberate
   scope limit). For delivery partners specifically, this also decrements pending
   / increments paid commission counters and sweeps that partner's `CONFIRMED`
   referrals to `PAID` so the partner-facing dashboard stays consistent.
   **Instructors have no equivalent pending/paid split** — their earnings
   figure is a flat lifetime total, and availability is derived purely from
   the payout ledger.
4. **Admin rejects**: any non-paid payout can be rejected with a note; this
   releases the held balance so the payee can request again immediately.

### 7.13 Reviews
Moderation queue (`PENDING | APPROVED | HIDDEN`). Approving/hiding a review
immediately recomputes the course's public star rating and review count from
`APPROVED` reviews only — pending/hidden reviews never count toward it.

---

## 8. Cross-cutting mechanisms worth knowing

- **Order fulfillment is the single choke point** for granting course access —
  every path that can result in a student owning a course (paid checkout,
  free checkout, refund reversal) runs through the same idempotent
  `OrdersService.fulfill()` / refund-reversal logic. If you're debugging "why
  doesn't this student have access," start there.
- **Money is stored as integer cents everywhere** — no floating point for
  prices, earnings, or payouts.
- **Webhooks are public routes but not unauthenticated** — Stripe's signature
  is cryptographically verified; both gateways are protected from duplicate
  delivery via a `(provider, eventId)` uniqueness check before any processing.
- **Snapshots protect historical records** — order line items snapshot the
  price/title at purchase time; payouts snapshot the destination at request
  time. Neither retroactively changes if the live data changes later.
- **Background jobs (BullMQ/Redis)**: the consistency rollup (hourly), the
  marketing-automation sweep (hourly), the FX-rate refresh (daily) and the
  admin digest (daily). All are designed to fail safe (skip a user, keep the
  last rate) rather than send bad data or crash.
- **Email is best-effort everywhere** — every `EmailService` call in a
  request path is wrapped so a delivery failure never fails the underlying
  action (signup, invite, password reset all succeed even if the email never
  arrives). Fulfilment emails the buyer their receipt with the PDF attached,
  and the same PDF stays downloadable from `/dashboard/billing` (§3.1).
