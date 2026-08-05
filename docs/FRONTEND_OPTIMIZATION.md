# Frontend Optimization Report — `apps/web`

**Scope of the audit:** `app/(storefront)/*` (home, courses, course detail, cart, checkout,
login/signup, teach) plus everything it pulls in (`lib/api`, `lib/context/store.tsx`,
`components/storefront`, `components/shared`, `components/ui`). Other route groups
(`(student)`, `admin`, `instructor`, `org`, `sales-agent`) were sampled to confirm which
findings are storefront-specific vs. systemic — most are systemic, which is why the file
structure section proposes one convention for the whole app, not just the storefront.

This is a report, not a diff — nothing has been changed. Section 8 lists open questions I'd
want answered before touching code, since some of these are one-way doors (type system,
folder convention) that are expensive to reverse once 40+ files depend on them.

---

## 1. Executive summary

The app is a Next.js 16 App Router project that, structurally, is being used like a
client-side SPA with a Node backend bolted on for the first paint. That's the single
root cause behind most of what follows:

| # | Finding | Impact | Effort |
|---|---|---|---|
| 1 | [Course detail & catalog are 100% client-rendered](#2-rendering-strategy-the-core-problem) | High — no SSR HTML, no SEO, slow LCP on the pages that matter most commercially | Medium |
| 2 | [No RSC↔React Query hydration bridge](#3-data-fetching-the-missing-hydration-bridge) | High — root cause of #1; also duplicated fetch logic | Medium |
| 3 | [No `generateMetadata`, no sitemap/robots, no structured data](#4-seo--metadata) | High for a course marketplace — organic search is a primary acquisition channel | Low–Medium |
| 4 | [77% of files are Client Components](#5-use-client-placement) (90/117 in `app`+`components`) | Medium — larger bundles, slower hydration, gratuitous `"use client"` on layouts | Medium |
| 5 | [No `loading.tsx` / `error.tsx` / `not-found.tsx` anywhere](#6-missing-route-level-boundaries) | Medium — no streaming, ad-hoc error handling per component instead of framework-level | Low |
| 6 | [Monolithic page/component files (300–650 lines)](#7-file-size--component-organization) | Medium — hard to review, hard to test, hides the above problems | Medium |
| 7 | [Parallel "legacy" type system + adapter layer](#8-the-legacy-type-adapter-layer) duplicating `@skillstream/shared` | Medium — defeats the "one schema, shared by api and web" design the README describes | High (if fully removed) |
| 8 | [`next/image` essentially unused](#9-images) (1 usage in 117 files), no `remotePatterns` configured | Low–Medium | Low |
| 9 | [Duplicated inline queries instead of shared hooks](#10-duplicated-data-fetching-logic) | Low — works, but drifts over time | Low |
| 10 | [Flat `components/` split by *portal*, not by *feature*](#11-proposed-file-structure) | Low today, compounding — this is the one to fix before the codebase gets bigger | Medium (mechanical) |

Items 1–3 are the ones I'd prioritize — they're the difference between "works" and "is
actually indexable/fast," and they're also the ones that get *more* expensive to fix the
longer more pages copy the current `useCourse()`-in-a-client-component pattern (which
several already have, per the admin/instructor sampling).

---

## 2. Rendering strategy: the core problem

Compare these two pages, both in the same route group:

**`app/(storefront)/page.tsx`** (home) — a Server Component. Fetches with `serverApi()`
directly in the async component body, ships fully-rendered HTML, degrades per-section on
API failure via a local `safe()` helper:

```tsx
// app/(storefront)/page.tsx:78-91
export default async function HomePage() {
  const [coursePage, instructors, categories, testimonials] = await Promise.all([
    safe(serverApi<Paginated<CourseSummaryDto>>(`/courses?pageSize=${MAX_PAGE_SIZE}`), {...}),
    safe(serverApi<InstructorRosterDto[]>("/instructors"), []),
    ...
  ]);
```

**`app/(storefront)/courses/[slug]/page.tsx`** → `CourseDetailLoader` — a Client Component.
Ships an empty shell, then fetches after hydration:

```tsx
// components/storefront/course-detail-loader.tsx:1-11
"use client";
import { useCourse } from "@/lib/api/hooks";

export function CourseDetailLoader({ slug }: { slug: string }) {
  const { data, isLoading, isError } = useCourse(slug);
  if (isLoading) return <Skeleton .../>;
  ...
```

Same story for `/courses` → `CatalogClient` (`"use client"`, fetches via `useCourses()`).

**Why this matters specifically for this app:** a course marketplace's two most
commercially important pages — the catalog (top of funnel, what Google indexes for
"`<topic>` course") and the course detail page (the actual landing page every ad, email,
and search result points to) — currently:

- Ship no server-rendered content. View-source on `/courses/personal-finance-mastery`
  today returns a loading skeleton, not the course title/description/price.
- Have no `<title>`/`<meta description>` per course (see §4).
- Pay a full waterfall: HTML → hydrate → JS fetch → render, instead of HTML arriving
  with data already in it.
- Can't be statically generated or ISR'd even for the (very cacheable) parts of a course
  page — title, description, curriculum, instructor bio — because the whole tree is a
  client fetch.

The home page proves the team already knows the correct pattern (`serverApi` in an async
Server Component). It just wasn't applied to the two pages that need it most, likely
because those pages also need client interactivity (add-to-cart, review dialog, filters)
and the fastest way to get that was "make the whole page a client component." That's the
trap — interactivity requirements don't require the *data fetch* to move to the client,
only the specific interactive leaves.

### Recommended pattern

Server Component fetches and renders the static shell; a thin Client Component wraps only
the interactive parts (cart button, review dialog, filter sidebar), receiving server-fetched
data as props:

```tsx
// app/(storefront)/courses/[slug]/page.tsx  — Server Component
export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dto = await serverApi<CourseDetailDto>(`/courses/${slug}`);
  if (!dto) notFound();
  return <CourseDetail course={toLegacyCourseDetail(dto)} />;
}
```

`CourseDetail` itself splits into a server shell (hero, curriculum, description — all
static per request) and small client islands (`<AddToCartButton>`, `<ReviewDialog>`,
`<CourseComments>`) — see §7 for the concrete file breakdown.

This is not "remove React Query from the storefront" — it's "don't make React Query the
*only* source of the first paint." §3 covers how the two combine.

---

## 3. Data fetching: the missing hydration bridge

`QueryProvider` is a bare `QueryClient` with no server-side dehydration:

```tsx
// lib/api/query-provider.tsx
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: {...} }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

TanStack Query's documented Next.js App Router integration prefetches in the Server
Component, dehydrates the cache, and hydrates it client-side via `<HydrationBoundary>` —
so a client hook like `useCourse(slug)` resolves *instantly* from the same data the server
already fetched, instead of re-fetching from scratch after mount. Right now every
`useQuery` call in the storefront (`useCourses`, `useCourse`, `useCategories`, the inline
query in `cart/page.tsx`) starts cold on every navigation.

**Recommended fix:** add the hydration boundary once in `lib/api/query-provider.tsx` (or a
new `lib/api/hydrate.ts` helper), then in each Server Component page that needs a client
island to read data already fetched server-side, prefetch + dehydrate before rendering the
boundary. This is what turns "Server Component fetch" and "Client Component interactivity"
into one consistent system instead of two competing ones — it directly fixes §2 without
throwing away React Query (which is still the right tool for mutations, polling, and
client-only refetches like the cart's live quote).

---

## 4. SEO & metadata

Confirmed gaps, project-wide:

- **No `generateMetadata`** anywhere except a hardcoded `export const metadata` in the root
  layout (`app/layout.tsx:24-28`) and one static one on `verify/[serial]`. Every course
  page, every category filter, `/teach`, `/login` — all share the site-wide title/description.
  Search results for a specific course currently show "SkillStream — Learn anything,
  anywhere" instead of the course title.
- **No `app/sitemap.ts`** — Next.js's built-in sitemap generation API isn't used, so course
  pages have no discovery path for crawlers beyond internal links.
- **No `app/robots.ts`**.
- **No JSON-LD structured data** (`Course`, `Product`/`Offer`, `AggregateRating`,
  `BreadcrumbList`) — Google's course-rich-results feature specifically looks for `Course`
  schema; without it, listings lose the enhanced SERP treatment competitors doing this
  correctly will get.
- **No `generateStaticParams` / ISR** on `courses/[slug]` — explicitly called out in the
  page's own comment as a deliberate choice ("the catalog is database-driven ... fetched
  client-side"), but that reasoning conflates two separate decisions: *database-driven*
  doesn't require *client-fetched*. `serverApi` + `revalidate` (ISR) or `dynamic = "force-dynamic"`
  both handle database-driven content server-side; see open question in §8 about how fresh
  course pages need to be (pricing/seat count argue for short-revalidate ISR rather than
  fully static).

**Recommended fix**, once §2/§3 land (metadata needs the same server-fetched `dto`):

```tsx
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const dto = await serverApi<CourseDetailDto>(`/courses/${slug}`);
  return {
    title: `${dto.title} | SkillStream`,
    description: dto.subtitle,
    openGraph: { title: dto.title, description: dto.subtitle, images: [dto.thumbnail] },
  };
}
```

Plus `app/sitemap.ts` (enumerate published course slugs from the API), `app/robots.ts`, and
a `<script type="application/ld+json">` for `Course` schema in the detail page.

---

## 5. `"use client"` placement

90 of 117 `.tsx` files under `app/` + `components/` open with `"use client"` (77%). Some of
that is legitimate — anything using `useState`, framer-motion, TanStack Query hooks, or
browser APIs has to be a client component somewhere in its tree. But the *placement* is
often too high:

- **Every portal layout is a Client Component**: `app/(student)/layout.tsx`,
  `app/admin/layout.tsx`, `app/instructor/layout.tsx` all start with `"use client"`, solely
  because they call `useSession()` to show the logged-in user's name/initials in the nav
  chrome. The session (`GET /auth/me`, cookie-authenticated) is exactly the kind of read
  `serverApi` already handles elsewhere (it forwards cookies). Fetching the session
  server-side in the layout and passing `{ user }` as a prop to a small client `<UserMenu>`
  would let the rest of the nav chrome (which is otherwise static markup) render on the
  server, and would remove a client-side loading flicker on every portal page load.
- **`CatalogClient`, `CourseDetailLoader`, `CourseDetail`** are single client components
  covering everything from data-fetch to static description text to the interactive
  purchase button — see §2 and §7.
- Components that genuinely need `"use client"` (17 in `components/ui`, the shadcn/Base UI
  primitives; motion wrappers; dialogs) are the right place for the boundary — that's
  expected and fine.

**Rule of thumb to apply project-wide:** default to Server Component; add `"use client"`
at the smallest component that actually needs interactivity/hooks/browser APIs, not at the
page or layout. A page can be a Server Component that renders three Client Component
islands — it doesn't have to *be* one to *contain* one.

---

## 6. Missing route-level boundaries

No `loading.tsx`, `error.tsx`, or `not-found.tsx` exists anywhere in `app/` (verified via a
full-tree search). Consequences:

- No automatic streaming/Suspense fallback per route segment — `courses/page.tsx` manually
  wraps in `<Suspense>` with an inline fallback (the *right* idea), but this is done ad hoc,
  once, instead of via the framework convention that'd apply consistently to every segment
  including the ones that currently show nothing while loading (e.g. `/dashboard`, most of
  `/admin/*`).
- No error boundary — an unhandled throw in a Server Component (e.g. `serverApi` rejecting
  because the API is down) currently produces Next.js's generic unstyled error screen
  instead of an on-brand fallback. `CourseDetailLoader` works around this per-component with
  manual `isError` checks, which is fine for *that* component's own fetch but doesn't catch
  errors in siblings or in the Server Component tree above it.
- No `not-found.tsx` — `CourseDetailLoader` renders an inline "Course not found" block
  instead of calling `notFound()`, so a bad slug returns HTTP 200 with "not found" copy
  instead of a real 404. That's a real SEO issue too (soft 404s get flagged by Google).

**Recommended fix:** add `app/(storefront)/loading.tsx` (and per-segment overrides where a
route needs a different skeleton, e.g. `courses/loading.tsx` matching the grid layout), a
root `app/error.tsx` + `global-error.tsx`, and `app/(storefront)/courses/[slug]/not-found.tsx`
driven by an actual `notFound()` call instead of a manual empty state.

---

## 7. File size & component organization

Representative sizes (not outliers — this is the norm, not the exception):

| File | Lines | Mixes |
|---|---|---|
| `components/storefront/course-detail.tsx` | 649 | hero, video preview, curriculum accordion, requirements, instructor bio, reviews, rating bars, review dialog, purchase card — 7+ distinct concerns in one file/one client boundary |
| `app/(storefront)/page.tsx` | 428 | data fetching + hero + category rail + 2× course grids + features + instructors + testimonials + CTA, plus 4 local helper components |
| `app/(storefront)/checkout/page.tsx` | 314 | (sampled, not fully read — flagged by line count) |
| `app/admin/pricing/page.tsx` | 353 | same pattern, confirms this is systemic, not storefront-specific |
| `app/admin/marketing/page.tsx` | 346 | same |
| `app/admin/agents/page.tsx` | 324 | same |

None of these are "doing too much work" in a complexity sense — the logic itself is
reasonable. The problem is **one file = one page = one client boundary = every concern**,
which means:

- You can't tell from the file tree that "purchase card" and "review dialog" are separable
  units — they're only separable if you read 649 lines.
- Every concern shares the same `"use client"` boundary even when most of it
  (curriculum list, requirements, description) has zero interactivity and could be server-
  rendered.
- Testing/reviewing a 650-line component means testing/reviewing seven components at once.

**Recommended fix:** split by concern, not just by file-size threshold — each split should
correspond to a real seam (a thing that could be independently server- or client-rendered,
independently tested, or independently reused). For `course-detail.tsx`, that's roughly:
`course-hero.tsx` (server), `course-curriculum.tsx` (server), `course-purchase-card.tsx`
(client — cart/buy buttons), `review-dialog.tsx` (client), `rating-bars.tsx` (server, pure
presentational). See §11 for where these files should live.

---

## 8. The legacy type/adapter layer

`packages/shared` exists specifically so "one schema → runtime validation + static types on
both API and web" (per the root README). But the storefront doesn't consume those DTOs
directly — every API response is funneled through `lib/api/adapters.ts` into a **second,
hand-maintained type system** in `apps/web/types/index.ts` (334 lines), explicitly labeled
legacy in its own header comment:

```ts
// lib/api/adapters.ts:1-3
// Maps API DTOs (cents, UPPER enums, nested instructor) back onto the prototype
// domain types the existing UI components consume. Lets us swap the data source
// to the live API with minimal component churn.
```

This made sense as a migration shim (per the README: "This started as a static Next.js
prototype with mocked data"), but the migration is now complete — README §"Frontend data
status" confirms *nothing* still reads from `lib/mock/*`. Keeping the adapter layer
permanently means:

- Two parallel type systems to keep in sync by hand (`CourseLevel` enum in
  `@skillstream/shared` ↔ `Level` string union in `@/types`, cents-as-integer ↔
  dollars-as-float, `UPPER_CASE` status ↔ `lowercase` status).
- Every new field added to a Prisma model + DTO needs a matching edit in `adapters.ts` and
  `types/index.ts` before any component can see it — an easy step to forget, and the kind
  of drift that produces silent bugs (a field present in the API response but never mapped
  through).
- `lib/mock/*` (courses.ts, instructors.ts, orders.ts, students.ts, etc. — 8 files) is
  confirmed dead code per the README's own admission ("safe to delete") but is still present
  and still exports the types the legacy layer was built to match, so it's easy to
  accidentally import from it.

**Recommended fix** (this is the one I'd want explicit sign-off on before starting — see
§8 open questions below, it's a bigger and riskier change than the others): retire
`apps/web/types/index.ts` and `lib/api/adapters.ts`, have components consume
`CourseSummaryDto`/`CourseDetailDto`/etc. from `@skillstream/shared` directly, and delete
`lib/mock/*`. This is mechanical but touches every storefront/student/instructor/admin
component that currently imports `@/types` — worth doing as its own dedicated pass, not
bundled into the rendering-strategy work.

---

## 9. Images

```
$ grep -rln "next/image" app components → 1 file
$ grep -rn "<img" app components         → components/shared/course-art.tsx:53
```

The one raw `<img>` is justified in a code comment (`data:` URLs aren't supported by
`next/image`) — that part's fine. But `next.config.ts` has zero configuration:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  /* config options here */
};
```

No `images.remotePatterns` is set, which means even *if* a component wanted to use
`next/image` for a real remote thumbnail URL (Cloudflare Stream poster images, an
instructor avatar from Resend/S3/wherever avatars end up), it can't yet — `next/image`
throws on any external host not in `remotePatterns`. Right now this mostly doesn't bite
because course art is CSS-gradient-and-icon placeholders (`CourseArt`), not real images —
but that's a demo-data artifact, not a permanent design decision, and it means the
optimization gap (responsive `srcset`, lazy loading, AVIF/WebP negotiation) will show up
the moment real course thumbnails or instructor photos are wired in, unless it's addressed
now.

**Recommended fix:** configure `images.remotePatterns` for the known real image sources
(Cloudflare Stream domain, wherever avatars will be hosted) now, so `next/image` is ready
to use the moment real images land instead of becoming a second migration later.

---

## 10. Duplicated data-fetching logic

`lib/context/store.tsx` and `app/(storefront)/cart/page.tsx` both independently define:

```ts
useQuery({ queryKey: ["store", "courses"], queryFn: () => api.courses({ pageSize: MAX_PAGE_SIZE }), staleTime: 60_000 })
```

Identical key and query function, written twice. React Query dedupes by key at runtime so
this isn't a correctness bug today, but it's two places that have to be kept in sync by
hand, and `lib/api/hooks.ts` already exists as the canonical home for named query hooks
(`useCourses`, `useCourse`, `useCategories`, ~30 others) — this one just isn't in it.

**Recommended fix:** promote this to a named `useCatalog()` hook in `lib/api/hooks.ts`,
same as every other query in the app, and use it in both places.

---

## 11. Proposed file structure

This is the part meant to generalize past the storefront. Two problems compound today:

1. `components/` is split **by portal** (`storefront/`, `student/`, `instructor/`,
   `admin/`) plus two catch-alls (`shared/`, `ui/`) — but a "portal" isn't a cohesive unit,
   it's just "pages under this route group." A component like `course-detail.tsx` has
   nothing to do with `sale-banner.tsx` other than both being under `storefront/`.
2. Nothing is colocated with the route that owns it — every component lives in the global
   `components/` tree regardless of whether anything outside its one page ever imports it
   (`course-detail.tsx`, `catalog-client.tsx`, and `course-detail-loader.tsx` are each used
   from exactly one route).

Next.js App Router supports **colocation** via private folders (any folder prefixed `_` is
excluded from routing, so `app/(storefront)/courses/[slug]/_components/` is safe to put
page-only components in without them becoming routes). The proposed convention:

```
app/
  (storefront)/
    layout.tsx
    loading.tsx                    # NEW — route-group-level fallback
    error.tsx                      # NEW
    page.tsx                       # Server Component: fetch + compose
    _components/                   # used by >1 storefront route (hero stat, section grid…)
      section-grid.tsx
      hero-preview.tsx
    courses/
      page.tsx                     # Server Component
      loading.tsx                  # NEW — matches the filter+grid skeleton
      _components/
        catalog-filters.tsx        # "use client" — the interactive filter sidebar only
        catalog-results.tsx        # "use client" — grid + pagination, receives initial data
      [slug]/
        page.tsx                   # Server Component: serverApi fetch + generateMetadata
        not-found.tsx              # NEW
        _components/
          course-hero.tsx          # server
          course-curriculum.tsx    # server
          course-purchase-card.tsx # "use client"
          review-dialog.tsx        # "use client"
          rating-bars.tsx          # server
    cart/
      page.tsx
    checkout/
      page.tsx
      success/
        page.tsx
    (auth)/                        # NEW route group — groups login/signup/forgot/reset
      login/
      signup/
      forgot-password/
      reset-password/
    teach/
      page.tsx

components/
  ui/                              # unchanged — shadcn/Base UI primitives, truly generic
  shared/                          # unchanged in spirit, but audited: only things used by
                                    # 2+ route groups belong here (price.tsx, stars.tsx,
                                    # course-art.tsx, motion.tsx qualify today; things used
                                    # by exactly one portal should move to that portal's
                                    # own _components)
  layout/                          # NEW — site-header, site-footer, sale-banner, portal-shell:
                                    # things that wrap pages rather than being pages

lib/
  api/                             # unchanged structure, already well-organized
  ...

types/                             # retired per §8, pending sign-off — DTOs come from
                                    # @skillstream/shared instead
```

**What moves where, concretely, for the storefront:**

- `components/storefront/course-detail.tsx` (649 lines) → split into
  `app/(storefront)/courses/[slug]/_components/*.tsx` per §7's breakdown.
- `components/storefront/catalog-client.tsx` → split into
  `app/(storefront)/courses/_components/catalog-filters.tsx` +
  `catalog-results.tsx`.
- `components/storefront/course-card.tsx` stays in `components/shared/` (or a new
  `components/course/` if it turns out to be reused from `admin`/`instructor` course lists
  too — worth checking before deciding; see §8 questions) since it's used from the home
  page, catalog, and cart.
- `components/storefront/site-header.tsx`, `site-footer.tsx`, `sale-banner.tsx` →
  `components/layout/` — these aren't "storefront" concerns, they're chrome that wraps
  pages, conceptually closer to `portal-shell.tsx` (already in `shared/`) than to
  `course-card.tsx`.

**Why colocation instead of the current global split:** it makes the "used by one route vs.
used everywhere" question answerable by looking at the file tree instead of grepping for
imports. A component that's only ever imported by its own route's `page.tsx` has no reason
to live three directories away in a global folder — colocating it removes a whole class of
"is this still used anywhere else before I change it" investigations, and it's the
convention Next.js's own routing already supports for free via `_folders`.

This is a **mechanical, low-risk migration** (move files, update imports) as long as it's
done as its own pass separate from the rendering-strategy changes in §2/§3 — bundling a
file-move refactor with a behavior change makes it much harder to review either one.

---

## 12. Suggested sequencing

Roughly in priority/dependency order — later items build on earlier ones:

1. **Quick wins, no architectural risk:** add `loading.tsx`/`error.tsx`/`not-found.tsx`
   (§6), configure `images.remotePatterns` (§9), promote the duplicated cart query to a
   named hook (§10), add `app/sitemap.ts` + `app/robots.ts` (§4).
2. **Data layer:** add the RSC↔React Query hydration bridge (§3) — this is what unlocks
   everything in §2 while keeping client interactivity working the same way.
3. **Rendering strategy:** convert `courses/[slug]` and `courses` to Server Component
   shells with client islands (§2), add `generateMetadata` + JSON-LD (§4) as part of the
   same pass since they need the same server-fetched data.
4. **File structure migration:** colocate storefront components per §11, apply the same
   convention to `(student)`, `admin`, `instructor`, `org`, `sales-agent` once the pattern
   is proven on the storefront.
5. **Type system consolidation:** retire the legacy adapter layer (§8) — biggest blast
   radius, do last, once everything upstream of it has settled.

---

## 13. Open questions

Answering these would change the shape of the recommendations above, so I'd rather ask
than assume:

1. **Course-detail freshness** — can course pages be static/ISR'd (say, `revalidate: 60`),
   or does pricing/seat-availability need to be request-fresh on every load? This decides
   between `generateStaticParams` + ISR vs. `dynamic = "force-dynamic"` for §2/§4.
2. **Legacy type system (§8)** — full removal (`@/types` + `adapters.ts` + `lib/mock/*`
   deleted, components consume `@skillstream/shared` DTOs directly) touches nearly every
   component in every portal. Do you want that as one dedicated pass, or would you rather
   phase it per-portal alongside the file-structure migration so each portal only changes
   once instead of twice?
3. **`components/shared` boundary** — some components there (`course-card.tsx`,
   `payout-panel.tsx`) may only actually be used by one portal today despite living in the
   shared folder. Want me to audit actual cross-portal usage before finalizing what moves
   to `components/layout/` vs. stays shared vs. moves into a portal-specific folder?
4. **Route groups for auth pages** — proposing `(auth)/` to group login/signup/forgot/reset
   under one route group (shared layout opportunity, e.g. a common auth-page shell). Any
   reason that's already deliberately flat (e.g. `/teach` needing to sit alongside them)?
5. **How much do you want done in one pass vs. incrementally** — items 1–3 in §12 are
   independently shippable and low-risk; items 4–5 are large mechanical/structural changes.
   Want me to start with §12 item 1 now and treat the rest as separate follow-ups you
   greenlight one at a time, or plan the whole sequence as one larger effort?
