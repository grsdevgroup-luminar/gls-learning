# Organization (B2B) Enrollment

How a company account gets onto SkillStream, how its admin and members are
provisioned, how a company's private courses are managed, and what happens
when a company account is suspended. Written for two audiences: a **plain-
language walkthrough** of each journey (for a client or non-technical
stakeholder to verify behavior), and a **technical reference** (data model,
endpoints, file map) for whoever maintains this next.

Status: implemented and live-verified (2026-09-06). Plan history:
`C:\Users\sarwa\.claude\plans\zippy-dancing-summit.md` (local machine, not in
the repo) has the original design discussion and research notes if deeper
"why" is ever needed.

**Changelog**
- 2026-09-06: **course visibility (Public/Private) and org assignment are now
  independent properties**, and a course can be assigned to more than one
  org. Previously "assign a course to an org" and "make it private" were the
  same action (`Course.orgId` was a single scalar, and assigning always
  flipped `visibility` to `PRIVATE`). Now:
  - `PATCH /courses/:id` accepts a platform-admin-only `visibility` field,
    settable independently of org assignment — see §3 and §6.
  - `Course.orgId` is gone; a `CourseOrgAssignment` join table (many-to-many)
    replaces it, so the same course can be curated into several orgs' lists.
  - Assigning a course to an org has **no visibility precondition** — a
    Public course can be assigned too (pure curation: it shows up in that
    org's list, but access was already universal). Only "must be `PUBLISHED`
    first" is enforced, for both visibilities.
  - Flipping a Private course back to Public, or unpublishing any course
    (public or private), is blocked while it still has any org assignment —
    prevents silently breaking a company's "Enroll" button or exposing
    content the assignment was gating. Unassign first, then the flip/unpublish
    succeeds.
  - Enrollment/lesson-access org-suspension checks (§4) now consider **every**
    org a course is assigned to: a member is blocked only once **all** of
    their assigned-and-member orgs are locked, not just one.
  See the design plan for the full rationale, including why assignment and
  visibility were deliberately decoupled (a platform-admin decision, made
  explicit after the first draft of this feature conflated the two).
- 2026-09-05: initial implementation (org provisioning, forced first login,
  suspension policy, private-course-leak fix).
- 2026-09-05 (later same day): course assignment restricted to platform
  `ADMIN` only — an org's own admin could previously self-assign any public
  course, which wasn't the intended policy. The org portal's Courses page is
  now read-only; see §2, §4, §6.
- 2026-09-05 (later still): reworked the admin's course-assignment dialog —
  it rendered unbounded (no max height/scroll on the dialog itself), so with
  enough courses in the catalog it broke by rendering partly off-screen. Now
  a bounded, single-scroll dialog with search, a category filter, and real
  pagination instead of fetching the whole catalog in one request; see §7.
- 2026-09-05 (final pass): fixed the search box's focus ring being clipped
  on the left edge (the scroll container had right-only padding — `pr-1`
  with no `pl-1` counterpart); added a Public/Private badge to every course
  row; added a one-click "assign all courses matching the current filter"
  action (with confirmation) so bulk-assigning a whole category — or every
  public course — doesn't mean clicking "Add" one at a time. Also fixed a
  cache-invalidation bug this surfaced: the dialog was invalidating
  `["store","courses"]` (the flat, all-at-once catalog key) but reading
  courses through the paginated `["courses", params]` key — assigning a
  course never refreshed the list the dialog itself was showing.
- 2026-09-05 (final): widened the dialog further and split "Assigned" /
  "Add courses" into two side-by-side columns at the `lg` breakpoint, each
  scrolling independently — browsing pages of the catalog no longer pushes
  the assigned list out of view. Below `lg` it falls back to the original
  single stacked column with one shared scroll (there isn't room for two
  columns on a phone). Verified in both themes and at mobile/desktop widths.
- 2026-09-05 (last pass): the dialog was `max-h-*` (shrinks to fit content),
  so assigning/removing a course visibly resized the modal — changed to a
  fixed `h-*` so it's always the same size regardless of how many courses
  are assigned or how many match the current filter. Also fixed a pagination
  edge case this surfaced: if `page` ends up past the actual `totalPages`
  (e.g. the result set shrinks while on a later page), the API returns an
  empty `items` array for that page instead of clamping it — the dialog now
  snaps `page` back to the last valid page whenever this happens, so the
  list can't silently go blank.
- 2026-09-05 (last): the category filter's dropdown sometimes opened
  *upward*, overlapping the dialog header — Base UI's `Select` defaults to
  `alignItemWithTrigger`, which lines the currently-*selected* item up with
  the trigger (native-`<select>`-style) rather than always opening below it;
  picking anything past the first item could slide the whole list upward to
  bring it into alignment. Set `alignItemWithTrigger={false}` on this
  dropdown (and the Plan dialog's status dropdown, same root cause) so both
  behave like an ordinary combobox and always open below the trigger.

---

## 1. The three journeys, in plain language

### Journey A — Platform admin creates a company account
1. Platform admin goes to **Admin → Organizations** and clicks **New
   organization**.
2. They type only the company name, an optional email domain, the admin's
   email, and a seat count. There is no "URL slug" field to fill in — the
   system generates a unique one from the company name automatically.
3. On save, SkillStream immediately creates:
   - the organization record,
   - a real login account for that admin email, with role "Org Admin",
   - a **temporary password**.
4. A one-time panel shows the admin's email and the temporary password (with
   a copy button), and confirms whether the welcome email was sent. This is
   the only time that password is ever shown — if the email fails to send,
   the platform admin can copy it and share it manually.
5. The company now appears in the Organizations table with an auto-generated
   slug, "Trial" status, and 1 of N seats used (the admin's own seat).

### Journey B — The company's admin logs in for the first time
1. The org admin receives the email (subject: *"Your `<Company>` organization
   is ready on SkillStream"*) with their email, the temporary password, and a
   link to the normal login page — there is no special invite link, they log
   in exactly like anyone else.
2. On successful login with the temp password, they are **forced** straight
   to a "Set your password" page before they can do anything else — every
   other page and API call is blocked until they do this.
3. Once they set a real password, they land in the **Organization Portal**
   (`/org/<slug>`) with full admin access. The temporary password no longer
   works.
4. If they ever forget their (real) password later, the normal "Forgot
   password" flow on the login page works exactly as it does for any other
   account — no special handling needed there.

### Journey C — Managing the company from both sides
- **Platform admin** (Admin → Organizations table): can edit seats, change
  status (Trial/Active/Suspended), and is the **only** one who can assign or
  unassign a company's courses, via a **Courses** dialog on that table
  showing what's currently assigned (with a remove button) alongside every
  other published course — public or private — in the platform (with an add
  button). Assigning is pure curation/distribution and never touches a
  course's visibility; see Journey E below for how visibility itself works.
- **Org admin** (Organization Portal): manages their own branding and invites
  ordinary team members (via an email link they click to set up their own
  account — the temp-password flow is only used for the very first admin
  account, not for regular members). Their **Courses** page is **read-only**
  — they can see exactly which courses SkillStream selected for their
  company (each labeled Public or Private), but cannot add or remove any
  themselves. This is deliberate: which courses a company gets is a
  commercial decision, not something a customer should be able to grant
  themselves (same policy as seats and status).
- **Org member**: sees a **"Team courses"** section in their normal student
  dashboard (`/dashboard/team`) listing the courses their company has made
  available, and can enroll for free. Once enrolled, it's the exact same
  course player everyone else uses.

### Journey E — Making a course Public or Private
A course's `visibility` is a platform-admin-only toggle in the course editor
(Admin → Courses → edit → Publish card), completely independent of org
assignment:
- **Public** (the default): listed in the open catalog, purchasable/
  enrollable by anyone. This is unaffected by being assigned to an org — an
  org's course list is just a curated shortcut to something everyone can
  already reach.
- **Private**: invisible to the public catalog and to `GET /courses/:slug`
  for anyone but a platform admin or a member of an org it's assigned to
  (404, not 403 — see §5). A Private course with **no** org assignments is
  reachable by nobody but a platform admin; assigning it to one or more orgs
  is what actually grants member access.
- The toggle is disabled until the course is `PUBLISHED` (can't privatize a
  draft), and flipping Private → Public is blocked while any org assignment
  still exists (see the changelog above and §3).

### Journey D — Suspending a company account
The platform admin picks *how* a suspension behaves at the moment they
suspend, via the same "Plan" dialog used for seats/status:

- **Lock immediately** — the company admin and every member instantly lose
  access to the org portal and to any of the company's courses (both the
  admin dashboard and the actual lesson player). Reactivating the org
  restores access instantly, with everyone's progress exactly where they
  left it — nothing is deleted or reset.
- **Grace period (N days)** — existing access keeps working for N more days
  (so people mid-course aren't cut off without warning), but **new**
  enrollments are blocked immediately regardless. After the grace period
  ends, access locks the same way "Lock immediately" does.

**Certificates already earned are never affected, in either mode.** A
learner who finished a course before (or during) a suspension keeps their
certificate, and it stays downloadable and verifiable — SkillStream never
revokes an earned credential, matching how every LMS we looked at (Docebo,
TalentLMS, Microsoft 365 seat suspension) treats this.

---

## 2. Roles & permissions

| Role | Where | Can do |
|---|---|---|
| Platform `ADMIN` | `/admin/organizations` | Create orgs, edit seats/status/suspension mode, assign/unassign courses (the **only** role that can), always bypasses an org's suspension lock |
| `ORG_ADMIN` (an `OrgMember` with `role: ADMIN`) | `/org/<slug>/*` | Manage their own org's branding, members, and invitations; **view** (not change) assigned courses — blocked entirely while the org's access is locked |
| Ordinary member (`OrgMember` with `role: MEMBER`) | `/dashboard/team` | Browse and enroll in the org's assigned courses — blocked from *new* enrollments the moment an org is suspended; blocked from *existing* course content once the lock takes effect |

An org can have more than one `ADMIN` member (removing the last one is
blocked by the API). A user's **platform** role (`STUDENT`/`ORG_ADMIN`/etc.)
is separate from their **org membership** role — see the data model below.

---

## 3. Data model

`apps/api/prisma/schema.prisma`

```prisma
model Organization {
  id             String    @id @default(cuid())
  slug           String    @unique   // generated from name, never typed
  name           String
  domain         String?
  adminEmail     String
  status         OrgStatus @default(TRIAL)   // TRIAL | ACTIVE | SUSPENDED
  suspensionMode OrgSuspensionMode?           // LOCK_NOW | GRACE_PERIOD — only meaningful while SUSPENDED
  accessLocksAt  DateTime?                    // the single field enforcement actually reads
  seatCount      Int       @default(10)
  usedSeats      Int       @default(0)
  members            OrgMember[]
  invitations        OrgInvitation[]
  courseAssignments  CourseOrgAssignment[]     // many-to-many via join table — see below
}

// Many-to-many: the same course can be assigned to several orgs, and
// assignment never touches Course.visibility (see Course below).
model CourseOrgAssignment {
  id        String       @id @default(cuid())
  courseId  String
  course    Course       @relation(fields: [courseId], references: [id], onDelete: Cascade)
  orgId     String
  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  createdAt DateTime     @default(now())

  @@unique([courseId, orgId])
}

model Course {
  // ...
  status         CourseStatus     @default(DRAFT)    // DRAFT | REVIEW | PUBLISHED
  visibility     CourseVisibility @default(PUBLIC)    // PUBLIC | PRIVATE — platform-admin only, independent of assignment
  orgAssignments CourseOrgAssignment[]
}

model OrgMember {
  id     String        @id @default(cuid())
  orgId  String
  userId String?                              // nullable — set once the invited person actually has an account
  role   OrgMemberRole @default(MEMBER)        // ADMIN | MEMBER
  // ...
}

model OrgInvitation {
  id     String @id @default(cuid())
  orgId  String
  email  String
  role   OrgMemberRole
  token  String @unique                        // the self-service invite/claim link, member-only
  // ...
}

model User {
  // ...
  role               UserRole @default(STUDENT) // includes ORG_ADMIN
  mustChangePassword Boolean  @default(false)   // set true only for admin-provisioned accounts
}
```

**The suspension lock is one formula, defined once**, in
`packages/shared/src/org-access.ts`:

```ts
function isOrgAccessLocked(org, now = new Date()): boolean {
  if (org.status !== "SUSPENDED" || !org.accessLocksAt) return false;
  return new Date(org.accessLocksAt) <= now;
}
```

- **Lock immediately**: `accessLocksAt` is set to the suspend time itself, so
  the formula is already true.
- **Grace period (N days)**: `accessLocksAt` is set N days in the future.
- **Reactivation** (status set back to `ACTIVE`/`TRIAL`): both fields are
  cleared to `null`.

This function is imported by every backend enforcement point (never
reimplemented), and its result is also exposed pre-computed as
`OrganizationDto.accessLocked` so the frontend never has to re-derive it.

> **Migration note**: the migration that introduced these two columns
> (`20260905085956_add_org_suspension_and_must_change_password`) backfills any
> org that was already `SUSPENDED` before this feature shipped, setting
> `suspensionMode = LOCK_NOW` and `accessLocksAt = now()`. Without that
> backfill, a pre-existing suspended org would have `accessLocksAt = null`,
> which the formula above reads as "not locked" — i.e. it would have silently
> regained full access the moment this shipped.

---

## 4. Suspension enforcement — where it's actually checked

| Checkpoint | File | Behavior |
|---|---|---|
| Org portal access (get/update/invite/remove member/etc.) | `apps/api/src/modules/organizations/organizations.service.ts` → `assertOrgAdmin()` | One choke point for every org-admin-portal endpoint. Platform `ADMIN` always bypasses. |
| Member course listing | same file → `listCourses()` | Same lock check for non-platform-admin callers. |
| New enrollment | `apps/api/src/modules/enrollment/enrollment.service.ts` → `enrollFree()` | Blocks **immediately** the moment `status === SUSPENDED`, regardless of grace period — a grace period only protects access already granted, never new signups. |
| Lesson / notes / quiz playback | same file → `assertLessonAccessible()` | One method already shared by `media.service.ts`, `notes.service.ts`, and `quiz.service.ts`, so this single check covers all content access. Respects the grace period. |
| Certificates | `certificates.controller.ts` / `certificates.service.ts` | **Deliberately untouched** — verify/PDF endpoints never look at `Organization` at all. |

Separately from the suspension lock, `assignCourse()`/`unassignCourse()` use
their own `assertPlatformAdmin()` check — this is a permanent permission
rule, not a suspension-related one: **an org's own admin can never assign or
unassign a course, suspended or not.** Only a platform `ADMIN` can.

`assignCourse()` itself only checks the course is `PUBLISHED` — no
visibility precondition — and rejects a duplicate assignment
(`@@unique([courseId, orgId])`, pre-checked for a clean error message rather
than surfacing the Prisma constraint error). `AuthoringService.update()`/
`setStatus()` separately gate the *other* direction: setting `visibility`
requires platform `ADMIN` and `status === PUBLISHED`; flipping back to Public
or moving off `PUBLISHED` is rejected while `countOrgAssignments(id) > 0`.

For a **Private** course, org-suspension enforcement (`enrollFree()` /
`assertLessonAccessible()`) now reasons over *every* org the course is
assigned to, not a single one: it collects the orgs the calling user is
actually a member of among those assignments, and blocks only when **all**
of them are suspended (or, for lesson access, currently past their
`accessLocksAt`) — being a member of just one still-active org is enough to
keep access.

---

## 5. Security fix bundled into this work

While auditing course access for the suspension feature, we found (and
fixed) a pre-existing bug: **`GET /courses/:slug` was public and returned the
full course detail — title, description, lesson list, signed resource URLs —
for *any* course, including private company-only courses and unpublished
drafts, to anyone who knew or guessed the slug.** It never checked visibility
or status.

Fixed in `apps/api/src/modules/courses/courses.service.ts` (`bySlug()`): a
DRAFT/REVIEW course now 404s for anyone but a platform admin, and a PRIVATE
org course 404s for anyone who isn't a member of that org. It always returns
`404 Not Found` (never `403 Forbidden`) so a caller can't tell the difference
between "doesn't exist" and "exists but you can't see it." Public, published
courses are completely unaffected — verified live against an anonymous
request.

---

## 6. API reference

| Method & path | Who | Notes |
|---|---|---|
| `POST /organizations` | Platform `ADMIN` | Creates the org **and** the admin's account+temp password in one transaction. Response includes the raw `tempPassword` (once) and `credentialsEmailSent`. |
| `GET /organizations` | Platform `ADMIN` | List, for the admin table. |
| `GET /organizations/:idOrSlug` | Org member/admin, or platform `ADMIN` | 403 if the caller's org access is currently locked. |
| `PATCH /organizations/:id` | Org admin (branding only) / Platform `ADMIN` (seats, status, suspension mode, grace days) | Setting `status: "SUSPENDED"` requires (or defaults) `suspensionMode`; `GRACE_PERIOD` requires `graceDays`. |
| `POST /organizations/:id/invite` | Org admin | Unchanged — self-service invite-link flow, for ordinary members. |
| `POST /organizations/claim/:token` | Any logged-in user | Unchanged. |
| `GET /organizations/:id/courses` | Org admin/member, or platform `ADMIN` | Read-only for anyone but a platform admin — this is what the org portal's Courses page and the member-facing Team Courses page both call. Each item carries `visibility` so those pages can show a Public/Private label instead of assuming Private. |
| `POST/DELETE /organizations/:id/courses[/:courseId]` | **Platform `ADMIN` only** | Assign/unassign. Rejects an org's own admin with 403 (`assertPlatformAdmin()`), regardless of suspension state. Assigning only requires the course be `PUBLISHED` — no visibility precondition, and never changes `visibility`. A course can be assigned to more than one org. |
| `PATCH /courses/:id` | Platform `ADMIN` only for the `visibility` field | Rejects a non-admin caller who includes `visibility` at all (even unchanged); rejects `PRIVATE` unless `status === PUBLISHED`; rejects `PUBLIC` while the course still has any org assignment. |
| `GET /admin/courses` | Platform `ADMIN` | Extended with `visibility`, `category`, and `unassignedToOrgId` filters — the last one is what the org-assignment dialog uses to list "everything published this org doesn't already have." Items include `orgAssignmentCount`. |
| `POST /auth/force-password-change` | Any authenticated user with `mustChangePassword: true` | The only non-`@Public()` route such an account can reach besides `/auth/me`. Revokes the temp-password session and issues a fresh one. |

---

## 7. Where the code lives

**Backend**
- `apps/api/prisma/schema.prisma` — schema
- `apps/api/src/modules/organizations/{organizations.service,organizations.repository,organizations.controller}.ts`
- `apps/api/src/modules/auth/{auth.service,auth.controller,auth.repository,jwt.strategy}.ts`
- `apps/api/src/common/guards/must-change-password.guard.ts` — the forced-password-change gate
- `apps/api/src/common/decorators/decorators.ts` — `RequestUser.mustChangePassword`, `@AllowPendingPasswordChange()`
- `apps/api/src/modules/email/email.service.ts` — `sendOrgAdminCredentials()`
- `apps/api/src/modules/enrollment/{enrollment.service,enrollment.repository}.ts` — suspension gating on enroll/playback, multi-org "member of any assigned org" logic
- `apps/api/src/modules/courses/{courses.service,courses.repository,course.mapper}.ts` — the leak fix; `visibility` now on the public DTO; `bySlug()`'s membership check spans every assigned org
- `apps/api/src/modules/authoring/{authoring.service,authoring.repository}.ts` — the `visibility` field itself: admin-only gating, publish-before-private, block-flip-while-assigned, block-unpublish-while-assigned
- `apps/api/src/modules/admin/{admin.service,admin.repository}.ts` — `visibility`/`category`/`unassignedToOrgId` filters and `orgAssignmentCount` on the admin course list
- `packages/shared/src/org-access.ts` — the one shared lock formula
- `packages/shared/src/contracts/{organizations,auth,authoring,catalog,admin}.ts` — Zod schemas / DTOs

**Frontend**
- `apps/web/app/admin/organizations/page-client.tsx` — the admin table (create dialog, no slug field)
- `apps/web/app/admin/organizations/plan-dialog.tsx` — seats/status/suspension-mode editor
- `apps/web/app/admin/organizations/credentials-panel.tsx` — the one-time temp-password panel
- `apps/web/components/shared/manage-org-courses-dialog.tsx` — platform-admin-only assign/unassign dialog: currently-assigned courses (with remove, data-driven Public/Private badge) plus a searchable, category-filterable, paginated view of every other **published** course — public or private — via `adminApi.courses({status:"PUBLISHED", unassignedToOrgId, ...})` (with add, data-driven badge) and an "assign all matching" bulk action. A bounded flex-column dialog with one scrolling body (`h-[min(760px,calc(100vh-2rem))]` + `min-h-0 flex-1 overflow-auto`, plus `-mx-1 px-1` so a focused input's ring isn't clipped by the scroll container), so it stays on-screen, a fixed size, and fully visible regardless of catalog size.
- `apps/web/components/shared/bulk-assign-confirm-dialog.tsx` — the confirmation step for the bulk-assign action
- `apps/web/components/shared/course-builder.tsx` — the course editor's admin-only "Private course" switch (Publish card), disabled until Published, sent as a separate `PATCH` fired *after* any status transition in the same save so a same-click "publish + make private" doesn't race the backend's publish-before-private rule
- `apps/web/app/admin/courses/page-client.tsx` — admin course table: Visibility badge column, Orgs-assigned-count column, Public/Private filter buttons
- `apps/web/app/org/[slug]/courses/page-client.tsx` — org portal's course page, **read-only** (no assign/remove controls), Public/Private label now data-driven off `c.visibility` instead of assumed-Private
- `apps/web/app/(storefront)/(auth)/force-password-change/page.tsx` — the forced "set your password" page
- `apps/web/components/shared/force-password-change-gate.tsx` — global redirect for a deep link that lands on a flagged account
- `apps/web/lib/auth/destination.ts` — shared "where does this role land after auth" logic (used by both login and force-password-change)
- `apps/web/app/(student)/dashboard/team/page-client.tsx` — member-facing course list + locked-org banner, Public/Private label now data-driven off `c.visibility`

---

## 8. Testing

Unit tests (45+ across this feature area, all passing alongside the existing
suite — 245 total in `apps/api` as of 2026-09-06):

- `packages/shared/src/org-access.test.ts` — the lock formula's edge cases (not suspended, suspended-but-null-timestamp, future grace period, past lock time)
- `apps/api/src/modules/organizations/__tests__/organizations.service.test.ts` — slug collision handling, admin-email-already-exists rejection, suspension-mode computation, lock enforcement (including the platform-admin bypass), course-assignment permission (org admin rejected, platform admin allowed), assigning both Public and Private published courses, rejecting an unpublished course, rejecting a duplicate assignment, assigning the same course to a second org, and `unassignCourse` never touching visibility
- `apps/api/src/modules/authoring/__tests__/authoring-visibility.test.ts` (new) — non-admin rejected from setting `visibility`; publish-before-private; block flip-to-public while assigned; block unpublish while assigned (public or private course); publishing is never blocked by assignment count
- `apps/api/src/modules/auth/__tests__/force-password-change.test.ts` — password gets hashed (not stored in plaintext), flag cleared, old sessions revoked
- `apps/api/src/modules/courses/__tests__/courses.service.test.ts` — the leak fix, all visibility/status/caller combinations, and a Private course assigned to multiple orgs reachable by a member of any one of them
- `apps/api/src/modules/enrollment/__tests__/enrollment-org-suspension.test.ts` — new enrollment/lesson access blocked only once **every** assigned-and-member org is suspended/locked; access survives via a second, still-active org; a Public course assigned to a suspended org is unaffected — enrollment never checks org membership for it

Run them with `pnpm --filter api test` and `pnpm --filter shared test`.
`pnpm --filter api typecheck` / `pnpm --filter web typecheck` are clean
(pre-existing, unrelated failures in `certificates-persistence.test.ts` and
`enrollment-certificates.test.ts` predate this work).

Manual click-through checklist (all verified live against the local dev
environment on 2026-09-05/06):
1. Create an org with no slug field — confirm unique auto-generated slug.
2. Credentials panel shows the temp password; confirm the email is logged/sent.
3. Log in with the temp password — forced to `/force-password-change`; no
   other page or API call works until the password is set.
4. Set a new password — lands straight in `/org/<slug>`; the temp password
   no longer works.
5. Assign a course from the admin table's Courses dialog — confirm it
   appears (read-only) inside the org portal, and confirm an org admin
   gets 403 if they try to call the assign/unassign endpoint directly.
6. "View portal" button confirmed removed from the admin table.
7. Suspend an org with "Lock immediately" — org admin gets 403 on the portal,
   a member sees the locked banner on Team Courses instead of their courses.
8. Reactivate — full access returns immediately, no data lost.
9. `GET /courses/:slug` for a private/draft course — 404 for an anonymous or
   non-member caller; unaffected for a public, published course.
10. Flip a Published course to Private via the course editor — confirm the
    switch is disabled until Published; confirm the course now 404s by slug
    for an anonymous caller and disappears from `GET /courses` search.
11. Assign that Private course to two different orgs from the admin
    "Courses" dialog (both show up as assignable, mixed in with Public
    courses) — confirm a member of either org can view and enroll in it, and
    confirm trying to flip it back to Public is rejected with `400` while
    still assigned to either.
12. Confirm the admin courses table's Visibility/Orgs columns, and the
    Public/Private labels on the org portal's Courses page and the
    member-facing Team Courses page, all match actual `visibility` per
    course (not a hardcoded assumption) — checked in both light and dark
    theme.

---

## 9. Deliberately out of scope / known follow-ups

- **Ordinary member invites** still use the existing self-service
  invite-link flow (not a temp password) — this matches how Slack/GitHub/
  Vercel handle bulk team invites and needed no changes.
- **Existing-email collision** on org creation (the chosen admin email
  already has a SkillStream account) is rejected outright for now, rather
  than merging into that account. Revisit if this comes up often in practice.
- **"Resend credentials"** (if an admin never completes their first login and
  the platform admin wants a fresh temp password) is not built — a
  reasonable fast-follow, not required for this pass.
- **Org portal locked-state banner**: only the member-facing Team Courses
  page shows a friendly "paused" banner. The org-admin portal itself just
  403s per-page when locked (the backend enforcement is complete either way)
  — a portal-wide banner is a nice-to-have UI polish item, not a
  correctness gap.
- **Multi-org assignment transparency**: the "Add courses" list in the
  assignment dialog doesn't show "also assigned to N other orgs" on a course
  row — an admin assigning the same course to a second org has no in-dialog
  hint that it's already shared elsewhere (harmless; assignment is additive
  and idempotent-safe either way). A nice-to-have, not required for this pass.
