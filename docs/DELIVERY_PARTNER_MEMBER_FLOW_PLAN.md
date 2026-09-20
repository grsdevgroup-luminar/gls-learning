# Delivery Partner → Course Assignment → Member Flow — Implementation Plan

> Status: **shipped and live** — course assignment, member invites, and all
> four post-launch fixes below (§11) are in production. §12 covers separate,
> later work (referral/commission durable attribution + refund reversal) that
> this plan explicitly left "staying as-is" (§0) but which changed after a
> follow-up QA pass — see `FEATURE_FLOWS.md` §5.2 for the current state.
> Companion to [`FEATURE_FLOWS.md`](./FEATURE_FLOWS.md) §5 (delivery partner
> flow, now the up-to-date reference) and §6 (Organization/B2B flow, whose
> patterns this plan reuses throughout).

## 0. Scope and confirmed decisions

Based on QA of the existing flow and follow-up direction, here's what's locked in:

1. **The referral/commission system stays exactly as it is.** Course
   assignment + member invites are **additive** — a delivery partner keeps
   earning referral commission *and* gets assigned courses to redistribute to
   invited members. Not a replacement.
2. **Only a brand-new visitor (no existing account) can apply to become a
   delivery partner.** The application form collects full name, email,
   password, country, optional custom fields, and optional supporting
   documents — all in one submission that creates the account **and** the
   application together. An existing logged-in user (of any role) can no
   longer self-initiate a delivery-partner application.
3. **No second document-upload step after submission.** Everything document-
   related happens inside the single signup+apply form, before submit.
4. **A rejected applicant goes through support — no self-service reapply.**
   (This is a deliberate divergence from the instructor flow's pattern — see
   §2.4.)
5. **Course assignment mirrors the existing Organization course-assignment
   modal** (`ManageOrgCoursesDialog`) exactly in UX pattern, and **admin sets
   a per-course member cap at assignment time** (mirrors `Organization.seatCount`).
6. **Access is per-course**: inviting a member grants access to the specific
   course they were invited through, not to every course the partner has
   assigned. Schema updated accordingly (§3).
7. **Partner invites members the same way an org admin invites members** —
   same invite/claim mechanics, reusing the org pattern.
8. **Delivery partner dashboard gets a full-featured "Courses" table** —
   search, filters, pagination — plus a "Members"/invite capability, per course.
9. **Invited members access their course from a dedicated page**, not folded
   into `/dashboard/team` — see §6.3 for the reasoning (you asked for an
   honest take, not just agreement, so I reversed my earlier "fold it in"
   recommendation once I actually weighed it against the alternative).

### "Follow the instructor flow for the applicant-role part" — what that means concretely

I went through the instructor application flow in detail to answer this. Two
things carry over, one deliberately doesn't:

- **Carries over: there's no separate "applicant" role.** Instructor
  confirms this is the established pattern — `InstructorApplication`
  ([schema.prisma:317-341](../apps/api/prisma/schema.prisma)) tracks status,
  `User.role` stays `STUDENT` throughout. This is exactly what §2.1 below
  already proposed independently; the instructor flow is the precedent that
  confirms it.
- **Carries over: a derived status field on `AuthUserDto`, used for routing.**
  Instructor's `me()` resolves `instructorStatus` from
  `user.instructorProfile?.status ?? latestApplicationStatus(userId)`
  ([auth.service.ts:173-180](../apps/api/src/modules/auth/auth.service.ts)),
  and `destinationFor()` sends a `PENDING` applicant to `/instructor`
  right after login instead of `/dashboard`
  ([destination.ts:18](../apps/web/lib/auth/destination.ts)). **Delivery
  partner doesn't have this today** — `AuthUserDto` has no
  `deliveryPartnerStatus` field, so a pending applicant currently lands on
  `/dashboard` after login instead of their status page. This plan adds
  `deliveryPartnerStatus` for symmetry and the matching redirect. (`proxy.ts`
  already excludes both `/instructor` and `/delivery-partner` from role-gating
  for exactly this reason — no change needed there.)
- **Does NOT carry over: self-service reapply.** Instructor reuses the same
  `POST /instructors/apply` endpoint for a rejected user to reapply — the
  pending-check only filters on `PENDING`, so a `REJECTED` row doesn't block
  a new submission
  ([instructor.service.ts:85-102](../apps/api/src/modules/instructor/instructor.service.ts)),
  and the frontend shows a "Re-apply" button
  ([approval-gate.tsx:35-45](../apps/web/app/instructor/_components/approval-gate.tsx)).
  Per your decision #1, delivery partner does **not** get this — a rejected
  applicant sees a rejection notice pointing to support, full stop, and
  `POST /delivery-partners/apply` (the existing-user endpoint this would have
  reused) is removed entirely rather than kept in a restricted form. This
  also cleanly resolves what was an open question in the previous version of
  this doc (§2.4 used to ask "narrow reapply, yes or no" — now settled: no).

---

## 1. QA findings from the current build (context for what's changing)

I ran the existing flow end-to-end (fresh signups, real Mailpit email capture,
real admin actions) before this plan was written. Two things are worth
carrying forward:

- **Suspend/Reinstate already exists** and works correctly
  ([partners-tab.tsx](../apps/web/app/admin/delivery-partners/_components/partners-tab.tsx))
  — verified via a full suspend → dashboard-access-revoked → reinstate →
  access-restored cycle. It wasn't visible because it's a small text button
  packed into an 8-column table (`Partner, Region, Code, Commission,
  Referrals, Earnings, Status, [pending amount]`) that needs horizontal
  scrolling on anything narrower than a wide desktop. **This plan redesigns
  that table** (§4) as part of the course-assignment work, since it needs a
  new "Courses" action added to the same row anyway.
- **File upload genuinely works end-to-end**, verified by injecting a real
  `File` into the actual form's file input (not just hitting the API
  directly) and confirming it uploads and shows up correctly after
  submission.
- **One real bug found and worth fixing while touching this code**: reviewing
  an application whose `userId` is null (e.g. legacy/imported data — two of
  the seed records are exactly this) silently succeeds with zero
  notification and, on approval, no `DeliveryPartner` row is even created.
  Recommend either blocking review on userId-less applications or making the
  admin UI flag them explicitly. Low priority relative to the rest of this
  plan, but noted here so it isn't lost.

---

## 2. Applicant flow redesign

### 2.1 "Is there an applicant role?" — recommendation: no, keep it simple

You asked whether there's already an "applicant" role. There isn't — today a
pending applicant is just a normal `STUDENT` with a `DeliveryPartnerApplication`
row whose `status` is `PENDING`. **Recommend keeping it this way** rather than
adding a new `User.role` enum value, for a concrete reason found during QA:
`RolesGuard` and `proxy.ts` both branch on `User.role` in several places
(portal routing, admin gating, org access). A pending applicant needs to keep
behaving like an ordinary student in every other respect — browsing courses,
buying things, etc. — so their `role` should stay `STUDENT`; adding a new
enum value would mean auditing and updating every one of those branch points
for a status that's already fully expressed by `DeliveryPartnerApplication.status`.
The "one user, one role" principle is best served by *not* overloading `role`
with what is really an application-workflow state.

### 2.2 Why "only new visitors can apply" is the right call

This isn't just simplification — it closes a real gap. Today,
`POST /delivery-partners/apply` accepts **any logged-in user regardless of
role**. The review flow's approval step does `updateUserRole(userId,
"DELIVERY_PARTNER")` — an unconditional overwrite. That means, as the code
stands, an `INSTRUCTOR` or `ORG_ADMIN` could apply and, on approval, silently
lose their instructor/org-admin identity, with no warning anywhere. Restricting
applications to brand-new accounts (which have no other role to lose) removes
this failure mode entirely, consistent with "one user, one role."

### 2.3 What changes

| Area | Current | New |
|---|---|---|
| `apps/web/app/(storefront)/partner/page.tsx` | Branches on `user`/`alreadyPartner`/application status to show one of: signup form, apply form, pending view (with uploader), rejected view, "already a partner" view | Branches only on: **not logged in** → signup+apply form; **already a delivery partner** → redirect-style message; **pending applicant** → status card only, no uploader; **rejected applicant** → rejection notice + "contact support" copy, no form, no re-apply button (decision #4 below); **anything else while logged in** (a plain student who never applied) → the page explains this program is for new sign-ups only |
| `ApplyPartnerForm` (existing-user apply) | Used when a logged-in non-partner visits `/partner` | **Removed entirely**, including for reapply. No existing account, of any role or application history, can call apply directly. |
| `POST /delivery-partners/apply` | Open to any authenticated user | **Removed entirely** — see §2.4, now resolved. |
| `POST /auth/register-delivery-partner` | Combined signup+apply, already the primary path | **Kept as the only entry point.** No behavior change needed here — it already does exactly what's wanted. |
| Pending-status page (`PartnerDocumentUploader`) | Lets an applicant add *more* documents after submitting | **Removed entirely.** All documents are attached during the one-time form submission via the existing `StagedDocumentPicker` (already stages files client-side and uploads them right after account creation — this part doesn't change). |
| `DELETE /delivery-partners/apply/docs` | Used by the post-submit uploader | **Removed** — its only caller goes away with the uploader, and `StagedDocumentPicker`'s pre-submit removal is local component state, no API call. |
| `AuthUserDto` / `destination.ts` | No `deliveryPartnerStatus` field; a `PENDING` applicant lands on `/dashboard` after login | **Adds `deliveryPartnerStatus`** mirroring `instructorStatus` exactly (see the instructor-flow note above); `destinationFor()` sends a `PENDING` applicant to `/delivery-partner` after login, same as instructor. |

### 2.4 Resolved: rejected applicants go through support

Per decision #4: **no self-service reapply.** A rejected applicant's `/partner`
view (while logged in) shows the rejection reason and support contact info —
no form, no button back in. This is a deliberate divergence from the
instructor flow (which does allow silent reapply through the same endpoint);
seeing the instructor precedent made the tradeoff clearer, but "contact
support" is the explicit choice here. Their account simply continues as a
normal student account.

---

## 3. Data model additions

Mirrors the existing `Organization` pattern
([schema.prisma:988-1039](../apps/api/prisma/schema.prisma)) as closely as
possible, since it already solves this exact shape of problem and is
battle-tested in this codebase.

```prisma
model DeliveryPartnerCourseAssignment {
  id         String          @id @default(cuid())
  courseId   String
  course     Course          @relation(fields: [courseId], references: [id], onDelete: Cascade)
  partnerId  String
  partner    DeliveryPartner @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  // Set by the admin at assignment time (decision #4/#5) — mirrors
  // Organization.seatCount/usedSeats exactly, but scoped to this one
  // course-assignment rather than the whole partner, since access is
  // per-course (decision #2/#6).
  memberCap  Int             @default(10)
  usedSeats  Int             @default(0)
  createdAt  DateTime        @default(now())

  members     DeliveryPartnerMember[]
  invitations DeliveryPartnerInvitation[]

  @@unique([courseId, partnerId])
  @@index([courseId])
  @@index([partnerId])
}

// Per-course-assignment, not per-partner: the same person can appear as a
// separate row against a second course-assignment if the partner invites
// them again for a different course — each row is one course-access grant,
// not one "relationship with this partner."
model DeliveryPartnerMember {
  id                 String                          @id @default(cuid())
  courseAssignmentId String
  courseAssignment   DeliveryPartnerCourseAssignment @relation(fields: [courseAssignmentId], references: [id], onDelete: Cascade)
  userId             String?
  user               User?                           @relation(fields: [userId], references: [id], onDelete: SetNull)
  name               String
  email              String
  joinedAt           DateTime                        @default(now())

  @@unique([courseAssignmentId, email])
  @@index([courseAssignmentId])
  @@index([userId])
}

model DeliveryPartnerInvitation {
  id                 String                          @id @default(cuid())
  courseAssignmentId String
  courseAssignment   DeliveryPartnerCourseAssignment @relation(fields: [courseAssignmentId], references: [id], onDelete: Cascade)
  email              String
  token              String                          @unique
  expiresAt          DateTime
  claimedAt          DateTime?
  createdAt          DateTime                        @default(now())

  @@index([courseAssignmentId])
  @@index([token])
}
```

`DeliveryPartner` gains one relation: `courseAssignments`. `members` and
`invitations` now hang off `DeliveryPartnerCourseAssignment` instead of
`DeliveryPartner` directly, since access is per-course (decision #2/#6) —
"does this user have access to this course via a delivery partner" resolves
as: exists a `DeliveryPartnerMember` row where `userId` matches and
`courseAssignment.courseId` matches, same read-time resolution style as
`OrgMember` + `CourseOrgAssignment`.

**Resolved — no role field on `DeliveryPartnerMember`.** A delivery partner
is one person; there's no equivalent to an org having multiple admins, so
every invited member is just "a member," no tiers.

**Resolved — member cap, mirrors `Organization.seatCount`/`usedSeats`
exactly** (decision #4/#5), scoped per course-assignment rather than per
partner. Admin sets `memberCap` when assigning the course (default `10`,
adjustable afterward via `PATCH`). `usedSeats` increments on invite-claim and
decrements on member removal, same as org. Invite-sending is blocked once
`usedSeats >= memberCap` (mirrors org's "blocked if the org has no seats
left"); claim additionally re-checks the cap defensively before incrementing,
closing a small race the org flow doesn't currently guard against (two people
claiming the last seat at the same instant).

---

## 4. Admin: course assignment + Partners table redesign

### 4.1 New endpoints (mirrors `organizations.controller.ts` 1:1)

```
GET    /admin/delivery-partners/:id/courses
POST   /admin/delivery-partners/:id/courses        { courseId, memberCap }
PATCH  /admin/delivery-partners/:id/courses/:courseId   { memberCap }
DELETE /admin/delivery-partners/:id/courses/:courseId
```

Admin-only (`@Roles("ADMIN")`), consistent with the described flow — the
partner doesn't self-serve course assignment, same as an org admin can't.
`memberCap` is a required field in the assign dialog (decision #4), defaulting
to `10` in the UI same as the schema default, adjustable via `PATCH` later
without unassigning/reassigning.

### 4.2 Admin UI: reuse `ManageOrgCoursesDialog`'s pattern exactly

The existing component
([manage-org-courses-dialog.tsx](../apps/web/components/shared/manage-org-courses-dialog.tsx))
is well-built and directly adaptable: fixed-height two-pane modal (Assigned
on the left with remove buttons, searchable/filterable/paginated catalog on
the right with add buttons and a bulk-assign-by-filter action), responsive
stacking below `lg`. Plan is to extract the course-picker half into a shared,
parameterized component (it currently takes `orgId`/`orgApi` calls directly)
so both `ManageOrgCoursesDialog` and a new `ManagePartnerCoursesDialog` share
one implementation instead of duplicating \~250 lines. Concretely: parameterize
by an injected `{ list, assign, unassign }` API adapter instead of hardcoding
`orgApi.*` calls.

### 4.3 Partners table redesign (fixes the Suspend discoverability problem)

Current table has 8 columns fighting for space on one row. Redesign:

- Collapse `Region`, `Code`, `Commission`, `Referrals`, `Earnings` into a
  denser layout (e.g. commission/earnings as a compact two-line cell,
  matching patterns already used elsewhere in the admin panel) so the table
  fits without horizontal scroll on a standard laptop viewport.
- Replace the scattered inline text-buttons (Suspend/Reinstate, commission
  Save) with a single trailing **Actions** menu (dropdown: Edit commission ·
  Suspend/Reinstate · Manage courses), consistent with how admin tables
  elsewhere in this codebase handle multiple row actions. This is both the
  fix for "I don't see Suspend" and the natural place to add the new "Manage
  courses" entry point.

---

## 5. Delivery partner dashboard: Courses tab

### 5.1 New nav item

`apps/web/app/delivery-partner/layout.tsx` nav gains **Courses** (and
**Members**, §6) alongside Overview/Referrals/Earnings/Profile — same
`approved`-gated visibility as the existing items.

### 5.2 Endpoint

```
GET /me/delivery-partner/courses?q=&category=&page=&pageSize=
```

Returns the partner's assigned courses, paginated, with the same query-param
shape (`q`, `category`, `page`, `pageSize`) already used by
`adminApi.courses` and `orgApi.courses` elsewhere, for frontend consistency.

### 5.3 Table requirements ("all possible filters, searches, pagination")

Concretely, matching the standard already set by this codebase's admin tables
(e.g. `admin/courses`, `admin/delivery-partners`'s own tabs):

- **Search** — debounced text search over title (reuse `useDebouncedSearch`).
- **Filters** — category (reuse `useCategories()`), and a member-count/status
  filter is *not* applicable here since this table is courses, not members —
  but a "has invited members" vs "no members yet" filter could be useful;
  flagging as a nice-to-have, not required for v1.
- **Sort** — by title, by date assigned, by seats used (`usedSeats`/`memberCap`
  is already a stored pair on the assignment row per §3, so this is a plain
  column sort, no extra aggregation needed).
- **Seat usage column** — `usedSeats / memberCap` per row (e.g. "3 / 10"), so
  a partner can see at a glance which courses are near capacity before trying
  to invite someone.
- **Pagination** — reuse `AdminPagination` + row-count control, same
  component already used throughout the admin panel and this exact partner
  portal's own Referrals/Earnings tables.
- **Per-row action**: "Invite members" (opens the invite dialog scoped to
  that course) and a count/link showing how many members currently have
  access through that course.

This is a genuinely new *partner-portal* table (the existing reusable table
scaffolding — `AdminTableCard`, `AdminPagination`, `useDebouncedSearch` — all
live under `admin/_components` and get imported by the admin panel; this plan
reuses the same underlying components from the partner portal, not a
copy-pasted admin-only variant).

---

## 6. Member invite + claim + course access

### 6.1 New endpoints (mirrors `organizations.controller.ts`'s invite lifecycle, scoped one level deeper)

```
POST   /delivery-partner/courses/:courseAssignmentId/invite   { email }
GET    /delivery-partner/courses/:courseAssignmentId/members
GET    /delivery-partner/courses/:courseAssignmentId/invitations
DELETE /delivery-partner/invitations/:inviteId
DELETE /delivery-partner/members/:memberId

GET    /delivery-partner/invitations/:token          (public — invite preview)
POST   /delivery-partner/claim/:token                (authenticated — accept)
```

All partner-authenticated except the last two (public preview + authenticated
claim, same as org). Inviting, listing members, and listing invitations are
all scoped to one `courseAssignmentId` — resolved (decision #2/#6): access is
per-course, so there's no "invite to my partner network in the abstract."
`POST .../invite` returns `409`/validation error once
`usedSeats >= memberCap` for that assignment, mirroring org's "blocked if no
seats left"; `POST /claim/:token` re-checks the same cap before incrementing
`usedSeats`, closing the small race window org's own claim flow doesn't guard
against.

### 6.2 Invite email + claim page

Reuse the exact pattern from `/join/[token]`
([page.tsx](../apps/web/app/join/[token]/page.tsx)): handles both a
signed-out visitor (offers "Create account & join" or "I already have an
account", both round-tripping back to the same claim URL) and a signed-in
visitor (auto-claims on load). Generalize this single page to branch on
invite type (org vs. delivery-partner) rather than building a parallel page,
since the states (loading, invalid/expired, claim-in-progress, signed-out
offer) are identical — only the copy ("Join as a member to access your
company's courses" vs. "You've been invited to access \[course title]") and
the resulting redirect differ.

Email: new `DELIVERY_PARTNER_MEMBER_INVITED` template following the existing
notification-template registry pattern
([email-templates.registry.ts](../apps/api/src/modules/email/email-templates.registry.ts)),
sent the same way org invites are (logged to console in dev without email
config, sent via the configured driver otherwise).

### 6.3 Member's course access — a dedicated page, not `/dashboard/team`

**Decision #9, reversing my earlier "fold it into `/dashboard/team`"
recommendation** now that I've actually weighed it instead of defaulting to
the reuse-shaped answer. Here's the honest case for a separate page:

- **"Team" means something specific, and this isn't that.** `/dashboard/team`
  exists because an org is your employer — the label, the copy ("Team
  courses"), and the mental model all assume a B2B relationship. A course
  granted by a delivery partner isn't from your employer; it's closer to a
  referral/reseller grant from an individual. Folding it in means either
  renaming a page that org members already know, or showing partner-granted
  courses under a label that doesn't describe them.
- **The two relationships have different shapes going forward.** An org
  membership is one relationship → many courses, uncapped, until someone
  removes you. A partner grant is per-course with an explicit cap (decision
  #4) — closer to "you were given a seat" than "you joined a team." If a
  student ever needs to know *why* they lost access to something, or who to
  ask about it, conflating the two sources into one list makes that harder,
  not easier.
- **The code-reuse argument for folding in was weaker than it looked.** The
  existing page already does two queries (`orgApi.mine()` +
  `api.myEnrollments`); adding partner-granted courses wouldn't collapse to
  one query, it'd add a third alongside a second data shape to render and
  explain provenance for. That's not really "reuse," it's "one page serving
  two different concepts" — which cuts against the "clean, structured,
  maintainable" goal you asked for, not toward it.

**Recommendation: a new page**, e.g. `/dashboard/partner-courses` (naming
open to bikeshedding), built the same way `/dashboard/team`'s page-client is
structured — course cards, an enroll action via the same existing
`api.enrollFree(courseId)` path — but as its own page with its own label, so
provenance stays legible to the student. New sidebar nav entry alongside the
existing "Team" item.

---

## 7. Suggested build order

1. **Applicant flow simplification** (§2) — smallest, self-contained, removes
   code rather than adding it. Good first PR.
2. **Schema migration** (§3) — new tables, no behavior change yet.
3. **Admin course assignment** (§4) — extract the shared course-picker,
   build `ManagePartnerCoursesDialog`, redesign the Partners table.
4. **Partner dashboard Courses tab** (§5) — read-only first (list assigned
   courses), ship independently of member invites.
5. **Member invite + claim + access** (§6) — the generalized `/join/[token]`
   page, new endpoints, email template, `/dashboard/team` update.

Each step ships and is testable independently; nothing in 3–5 blocks on the
others existing first except that invites (5) need assigned courses (3, 4)
to be meaningful.

---

## 8. Testing plan

- Unit/service tests for the new repository/service methods (course
  assign/unassign, invite create/claim/revoke) — follow the existing pattern
  in `organizations.service.test.ts`.
- E2E: signup-only apply (confirm existing-user apply is actually gone —
  `403`/`404`, not just hidden in the UI), admin approve → assign course →
  invite member → member claims (both signed-out-then-signup and
  already-signed-in paths) → member sees and enrolls in the course from
  `/dashboard/team`.
- Regression: confirm referral/commission flow is untouched (existing
  referral E2E coverage, if any, or manual spot-check per
  [`FEATURE_FLOWS.md` §5](./FEATURE_FLOWS.md)).
- Manual: the Partners-table redesign and the file-upload staging flow,
  since both are UI-heavy and worth a human pass before shipping.

---

## 9. Decisions — all resolved

Every open question from the previous version of this plan has been answered:

1. ~~Reapply after rejection~~ → **No self-service reapply; contact support.** (§2.4)
2. ~~Member access scope~~ → **Per-course.** (§3, §6.1)
3. ~~Member role tiers~~ → **Flat "member," no tiers.** (§3)
4. ~~Seat/invite limits~~ → **Admin sets a per-course member cap at assignment time**, mirroring `Organization.seatCount`. (§3, §4.1)
5. ~~`/dashboard/team` vs. a separate page~~ → **Separate page** (`/dashboard/partner-courses` or similar), with the reasoning in §6.3.

Two small naming/detail items remain genuinely open and low-stakes enough to
decide during implementation rather than block on:
- Exact route/label for the new member-facing page (§6.3 suggests
  `/dashboard/partner-courses`).
- Default `memberCap` value in the assign-course UI (schema defaults to
  `10`, matching `Organization.seatCount`'s default — flag if a different
  default reads better for this context).

## 10. Checklist

- [x] Footer CTA → signup+apply form → application created (kept as-is)
- [x] Admin: approve / reject / suspend / reinstate (suspend already worked — fixing discoverability)
- [x] Remove existing-user apply path entirely (form, endpoint, post-submit document uploader, no reapply) — shipped and verified live: `POST /delivery-partners/apply` and `DELETE .../apply/docs` removed, `ApplyPartnerForm`/`PartnerDocumentUploader` deleted, `/partner` and `/delivery-partner` both show the new "contact support" rejected view and the new "new sign-ups only" view for an existing account, signup+apply path still works end-to-end
- [x] Add `deliveryPartnerStatus` to `AuthUserDto` + `destination.ts` redirect, mirroring `instructorStatus` — shipped and verified: a pending applicant now lands on `/delivery-partner` right after login
- [x] Schema: `DeliveryPartnerCourseAssignment` (with `memberCap`/`usedSeats`), `DeliveryPartnerMember`, `DeliveryPartnerInvitation` — all per-course-assignment-scoped. Migration `20260919112127_delivery_partner_course_assignments` applied.
- [x] Admin: `ManagePartnerCoursesDialog` built (generalized `BulkAssignConfirmDialog` for shared use rather than a full picker extraction — see note below), with required `memberCap` input at assign time. Verified live: assign/cap-edit/unassign all working, DB confirmed correct.
- [x] Admin: redesigned Partners table (Partner/Commission/Activity/Status/Actions, 5 columns) — Suspend/Reinstate now in an always-visible Actions dropdown, no horizontal scroll needed. Verified live.
- [x] Partner dashboard: Courses tab (search/filter/sort/pagination), per-row "Invite members" + seat usage (`usedSeats`/`memberCap`) — shipped at `apps/web/app/delivery-partner/courses/`, reusing `AdminTableCard`/`AdminPagination`/`useDebouncedSearch`. Verified live.
- [x] Partner dashboard: per-course Members/invite UI, cap-aware — `ManageMembersDialog` (invite form + members list w/ remove + pending invitations w/ revoke). Verified live via Mailpit-captured invite email.
- [x] Generalized claim page for partner invites, with defensive cap re-check on claim — built as a separate route (`/join/partner/[token]`) rather than branching one endpoint on invite type (see `invite-claim-shell.tsx` for the shared state machine both `/join/[token]` and `/join/partner/[token]` now use). Verified live end-to-end: signed-out visitor → create account & join → auto-claim → redirect.
- [x] `partner_member_invite` email template — added to `email-templates.registry.ts` and `EmailService.sendPartnerMemberInvite`. Verified live in Mailpit with correct partner name and course title.
- [x] New `/dashboard/partner-courses` page + sidebar nav entry for member course access — verified live, groups courses by partner, shows a suspended-partner warning banner per group.

### Bug found during end-to-end verification (not in original plan)

- **`enrollFree` didn't recognize delivery-partner access** — `findCourseAccess`/`findLessonAccessContext` in `enrollment.repository.ts` and `enrollFree`/`assertLessonAccessible` in `enrollment.service.ts` only ever checked org assignments for a PRIVATE course. A legitimately-invited partner member got `403 "This course is restricted to its organization"` when trying to enroll. **Fixed** — both now check delivery-partner course assignments as an alternative access path, same suspended-partner-blocks-access semantics as a suspended org.
- **`GET /courses/:slug` (course detail / `/learn/[slug]` page) 404'd for a partner member after enrollment succeeded** — `CoursesService.bySlug` had its own PRIVATE-course visibility check (`courses.service.ts`), entirely separate from `enrollment.repository.ts`, that only ever checked org membership via `isOrgMemberOfAny`. **Fixed**: added `EnrollmentRepository.findAnyPartnerMembershipForCourse` + `EnrollmentService.isPartnerMemberOfCourse` (mirroring `isOrgMemberOfAny`) and call it alongside the org check in `bySlug`. Verified live: partner member now loads `/learn/aws-cloud-practitioner` (lessons, progress sidebar, video player all render) and can mark a lesson complete (`POST /enrollments/:id/lessons/:id/toggle` → `201`).

---

## 11. Post-launch fixes (found in the wild, after this plan's checklist was marked done)

The checklist above says "verified live" throughout — that was true for the happy paths tested at the time, but a second QA pass (client-reported) turned up four more gaps, all now fixed:

1. **No way for an applicant to request a commission rate.** The apply form
   never asked, so admin approved blind every time. Added an optional
   *expected commission rate* field to the signup+apply form
   (`DeliveryPartnerApplication.expectedCommissionPercent`), surfaced on the
   admin application-detail view and used to pre-fill (not force) the
   approve dialog's commission-% input.
2. **A pending applicant could still use the full student dashboard.**
   `role` correctly stays `STUDENT` while `PENDING` (§2.1's design is right),
   but nothing stopped that account from using `/dashboard`/`/account` like
   an ordinary student in the meantime — only the post-login redirect sent
   them to `/delivery-partner` once. Fixed by making the student layout
   itself refuse to render for a `PENDING` delivery-partner applicant on any
   direct navigation, not just right after login. Also hardened
   `DeliveryPartnerService.assertOwnAssignment`/`myCourseAssignments`
   server-side against `status === APPROVED` — a **suspended** partner's
   self-service actions (invite/manage members, list assignments) were only
   hidden client-side, so a direct API call could bypass the suspension
   entirely.
3. **Application submission sent the wrong email.** `registerDeliveryPartner`
   fired the generic student "Welcome to GRS Learning" email instead of an
   application-specific confirmation — misleading, and inconsistent with the
   already-correct behavior of only emailing approval/rejection at admin
   review time. Added a dedicated `partner_application_submitted` template
   and `EmailService.sendPartnerApplicationSubmitted`.
4. **Partner-invite links 404'd as "Invitation not valid" even when fresh.**
   Root cause: `EmailService.sendPartnerMemberInvite` built the link as
   `/join/{token}` — the **org** claim route — instead of
   `/join/partner/{token}`. A fresh partner token hit a page that only knows
   how to validate org invites. One-line fix; the token generation/validation
   mechanics themselves (§6.1) were already correct.

While testing fix #4 live, a **second bug surfaced**: a member with a
legitimate partner grant on a course got `403 "This course requires
purchase"` trying to enroll. `enrollFree`/`assertLessonAccessible` in
`enrollment.service.ts` only ever checked the org/partner grant when
`course.visibility === "PRIVATE"` — but §4.1's admin course-assignment flow
lets a partner be assigned *any* published course, including `PUBLIC` paid
ones. Fixed by gating on `visibility === "PRIVATE" || basePriceCents > 0`
instead, while keeping a genuinely free `PUBLIC` course unaffected by an
unrelated org/partner suspension (a dedicated regression test — the org
"public course assigned to a suspended org is still free" case — pins this
down; see `enrollment-org-suspension.test.ts`).

## 12. Referral/commission durable attribution + refund reversal

Out of scope for this plan (which only ever covered course
assignment/member-invites — §0 says the referral/commission system "stays
exactly as it is"), but built the same week after a client walkthrough of
the *existing* referral flow surfaced two real gaps in it. Full writeup in
[`FEATURE_FLOWS.md`](./FEATURE_FLOWS.md) §5.2/§5.4/§7.10/§7.12 — summary:

- **Durable, signup-time referral attribution** (`User.referredByPartnerId`)
  replaces relying solely on a `localStorage` code carried to checkout,
  which silently broke across devices or a delayed purchase. Durable
  attribution takes priority; the checkout-time code is now only a fallback
  for accounts that predate this field.
- **Refunds now reverse delivery-partner commissions proportionally** —
  previously a completely missing path; a refunded order left the partner's
  earnings inflated forever. `DeliveryPartnerReferral.status` became a real
  Prisma enum (`PENDING | CONFIRMED | PAID | REVERSED`, was a loose string)
  with a new `reversedCents` counter. A `PAID` commission's reversal claws
  back against the partner's *next* payout automatically, through the
  existing floor-at-0 balance math — no new ledger.

Verified live end-to-end against the real API (register with a referral code
→ checkout with a *different*, conflicting code → durable attribution wins;
then a synthetic paid order refunded in two partial steps → exact
proportional reversal both times, capped correctly on the second). 11 new
unit tests (`admin-refund-partner-commission.test.ts`,
`referral-attribution.test.ts`) plus the full existing suite all pass.
