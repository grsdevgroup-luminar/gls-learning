# Changelog

## 2026-08-21

### Added

- Added a reusable course-preference modal for new learners after registration and for students updating their preferences from the dashboard.
- The modal presents all ten learning categories in a consistent five-column, two-row grid and requires exactly three selections before recommendations can be saved.
- Category cards now include category-specific icons, larger labels, and larger icons while retaining fixed card sizes so multi-word categories remain contained.
- The full-width modal preserves a wide desktop layout with two-inch side margins, a compact small-screen layout, loading states during saves, and a blurred page backdrop.
- Saved preferences drive the signed-in learner's recommended-course sections on the dashboard and storefront homepage.

### Changed

- Course-builder save actions remain visible while course details and curriculum content scroll, reducing the need to return to the top before saving.
- The sticky action bar is positioned below the mobile portal header and at the top of the workspace on desktop.

### Changed Files

- `apps/web/components/shared/course-preferences-modal.tsx`
  - Provides the shared three-category selection interface, category icons, selection limit, save feedback, responsive sizing, and accessibility states.

- `apps/web/app/(storefront)/(auth)/signup/page.tsx`
  - Opens the preference modal immediately after successful registration and redirects the learner after their selections are saved.

- `apps/web/app/(student)/dashboard/page.tsx`
  - Adds a learning-preferences summary and an Edit preferences action that reuses the shared modal.

- `apps/web/app/(storefront)/_components/personalized-recommendations.tsx`
- `apps/web/lib/api/hooks.ts`
  - Loads and refreshes preference-based recommendations after preferences change.

- `apps/web/components/ui/dialog.tsx`
  - Applies the blurred overlay used behind the preference modal.

- `apps/web/components/shared/course-builder.tsx`
  - Moves Save, Save draft, and Submit for review into a responsive sticky action bar without changing their save behavior.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`

## 2026-08-20

### Changed

- Browser tab titles now update for every application route instead of inheriting only the broad module title.
- Course detail pages continue to use their existing server-generated course titles.

### Changed Files

- `apps/web/components/shared/page-title.tsx`
  - Added centralized, route-aware browser-title handling for storefront, student, admin, instructor, sales-agent, organization, and utility pages.

- `apps/web/app/providers.tsx`
  - Mounted the route-title manager once for the full application.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`

## 2026-08-20

### Changed

- Removed the unnecessary country dropdowns from the cart and checkout. Regional pricing continues to use the shopper's existing region setting.
- Registration now saves the selected country as the storefront pricing region, so cart and checkout immediately use the same billing region after signup.

### Changed Files

- `apps/web/app/(storefront)/cart/page.tsx`
  - Removed the Pricing region country selector while preserving the regional-pricing notice and cart totals.

- `apps/web/app/(storefront)/checkout/page.tsx`
  - Removed the Billing region country selector while preserving the static region and pricing information.

- `apps/web/app/(storefront)/(auth)/signup/page.tsx`
- `apps/web/lib/context/store.tsx`
  - Persist the registration country’s ISO code as the pricing region before redirecting to the storefront.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`

## 2026-08-19

### Fixed

- Fixed the header course search retaining a stale `q` URL parameter after users clear the input or reduce it below the two-character search threshold.
- Clearing the header search now restores the full course catalog while preserving any other active catalog filters.

### Added

- Added reusable, layout-matched skeleton components for page headers, forms, course grids, tables, checkout, learning, discussion, and authentication screens.
- Added route-level loading boundaries for course catalog navigation, course learning, and storefront authentication.
- Replaced loading spinners, blank profile screens, and plain loading text in the catalog, checkout, learning flow, instructor workflows, team courses, admin settings, course discussions, and protected video player.
- Added per-organization course-grid skeletons so team-course sections do not briefly render an empty state while their data is loading.

### Changed Files

- `apps/web/components/layout/site-header.tsx`
  - Removes only the stale `q` parameter when an edited header search becomes empty or too short.

- `apps/web/components/shared/loading-skeletons.tsx`
  - Added shared skeleton layouts for common page and content patterns.

- `apps/web/app/(storefront)/courses/loading.tsx`
- `apps/web/app/learn/[slug]/loading.tsx`
- `apps/web/app/(storefront)/(auth)/loading.tsx`
  - Added route-level loading boundaries that match their destination layouts.

- `apps/web/app/(storefront)/courses/_components/catalog-results.tsx`
- `apps/web/app/(storefront)/checkout/page.tsx`
- `apps/web/app/(storefront)/courses/[slug]/_components/course-comments.tsx`
- `apps/web/app/(student)/dashboard/team/page.tsx`
- `apps/web/app/instructor/profile/page.tsx`
- `apps/web/app/instructor/_components/approval-gate.tsx`
- `apps/web/app/admin/settings/page.tsx`
- `apps/web/components/shared/course-builder.tsx`
- `apps/web/components/player/protected-player.tsx`
  - Replaced generic loading states with content-shaped skeletons.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`
  - `git diff --check`

- Note:
  - `pnpm --filter @skillstream/web lint` still reports pre-existing `react-hooks/set-state-in-effect` errors in billing, admin list pages, and the store context; the skeleton changes introduced no lint errors.

### Notes

- Skeleton screens improve perceived performance and reduce layout shift while requests resolve; they do not change backend/API response times.

## 2026-08-18

### Fixed

- Fixed the browser tab title remaining on the global “GRS Learning — Learn anything, anywhere” title while navigating between application modules.
- Added module-level metadata for the marketplace, student dashboard, admin portal, instructor portal, sales-agent portal, and organization portal.
- Added a shared “%s | GRS Learning” title template so module titles stay recognizable and consistently branded.
- Kept route-specific metadata, such as course detail titles, compatible with the global template instead of replacing it with a generic module title.
- Fixed the instructor account menu’s “My Learning” action to open `/dashboard/progress`, since instructors can also use the student learning area.
- Added an explicit “My Learning” item to the instructor portal sidebar, pointing to the student progress page.
- Allowed instructor sessions through `/dashboard/*` so the proxy no longer redirects them back to the instructor portal.

- Fixed “Resume course” opening the first lesson instead of the learner’s latest completed lesson.
- Resume now derives the furthest completed lesson from enrollment progress after that data loads, while preserving manual lesson selection.
- Removed the mutable `Set` dependency from the resume calculation so React Compiler no longer reports `react-hooks/preserve-manual-memoization`.

- Fixed the admin dashboard Revenue by region chart so each paid order is attributed to its resolved checkout region.
- Added a buyer-country fallback for historical paid orders that were created before order-region attribution was stored.
- Removed the six-region limit so the chart includes every region with paid revenue.
- Fixed the admin course conversion funnel to count enrolled courses, purchased courses, and completed courses instead of distinct users.
- Renamed the funnel stages and dashboard heading to make the course-based metrics explicit.

### Changed Files

- apps/web/app/layout.tsx
  - Changed the root title to a default plus reusable title template.

- apps/web/app/(storefront)/layout.tsx
- apps/web/app/(student)/layout.tsx
- apps/web/app/admin/layout.tsx
- apps/web/app/instructor/layout.tsx
- apps/web/app/sales-agent/layout.tsx
- apps/web/app/org/page.tsx
- apps/web/app/org/[slug]/layout.tsx
  - Added module-specific browser tab metadata at each navigation boundary.

- apps/web/components/layout/site-header.tsx
  - Explicitly routes instructor “My Learning” to the student progress section while preserving the instructor dashboard and course links.

- apps/web/app/instructor/layout.tsx
  - Adds the instructor portal’s own “My Learning” navigation item to `/dashboard/progress`.

- apps/web/proxy.ts
  - Treats instructors as valid student-dashboard users because an instructor can also be a learner.

- `apps/web/app/learn/[slug]/_components/learn-client.tsx`
  - Initializes the learner view at the furthest completed lesson in curriculum order.
  - Falls back to the first lesson when no lesson has been completed.
  - Keeps all hooks unconditional and avoids mutable memoization dependencies.

- `apps/web/app/admin/page.tsx`
  - Renamed the dashboard funnel heading to `Course conversion funnel`.

- `apps/api/src/modules/commerce/checkout.service.ts`
  - Persists the resolved checkout region on new orders for accurate revenue attribution.

- `apps/api/src/modules/admin/admin.repository.ts`
  - Loads paid orders with their stored region and buyer country fallback.
  - Counts enrollment records, paid order items, and completed enrollment records for the course funnel.

- `apps/api/src/modules/admin/admin.service.ts`
  - Aggregates paid revenue across every region, including historical fallback data.
  - Builds the funnel from course activity counts rather than distinct student counts.

- `packages/shared/src/contracts/admin.ts`
  - Updated analytics documentation to describe all-region revenue and course activity metrics.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web exec eslint "app/learn/[slug]/_components/learn-client.tsx"`
  - `pnpm --filter @skillstream/web typecheck`
  - `pnpm --filter @skillstream/web exec eslint "app/admin/page.tsx" "components/charts/charts.tsx"`
  - `pnpm --filter @skillstream/api typecheck`
  - `pnpm --filter @skillstream/api build`
  - `pnpm --filter @skillstream/api test`
  - `pnpm --filter @skillstream/shared typecheck`
  - `pnpm --filter @skillstream/shared test`

- Note:
  - The full web lint command still reports six pre-existing `react-hooks/set-state-in-effect` errors in unrelated dashboard pages.

### Reasoning

- The fixed title came from the root layout being the only metadata source. Placing titles at module layouts lets Next.js update the document head during route transitions while avoiding duplicated client-side pathname title logic.
- The root template centralizes branding, while nested route metadata supplies the meaningful module name.
- Revenue attribution now uses the checkout region saved on each order, with a buyer-country fallback only for historical orders that lack that field.
- The funnel labels describe course activity, so its values use enrollment records, paid order items, and completed enrollment records rather than distinct student IDs.

## 2026-08-16

### Added

- Removed the redundant, non-functional `Sort` control from the courses section.
- Kept the working sorting dropdown as the single sorting control.
- Clarified the course Rating filter to show that each option is a minimum rating threshold.
- Rating choices now display as `3.0 stars and above`, `4.0 stars and above`, and `4.5 stars and above`.
- Fixed stale enrollment state after course enrollment by unifying the storefront and learner enrollment query cache key.
- Enrolled learners now have their course access state refreshed consistently instead of seeing an enrollment access message from stale client data.
- Fixed intermittent role redirects after login by prioritizing the authenticated role over stale `next` paths.
- Admins now consistently land in `/admin`, and the proxy prevents an admin session from remaining in the student dashboard.
- Synchronized the freshly loaded authenticated user into the client session cache so names, emails, and role badges stay consistent.
- Added a shared 300 ms `useDebouncedValue` hook for search inputs.
- Applied debounced filtering to the course catalog, admin courses, admin students, admin sales agents, admin organizations, organization members, and sales-agent referrals.
- Applied debounced local filtering to the signup country picker and command palette.
- Kept search inputs responsive while delaying filtering and API-backed query updates until typing pauses.
- Added strict login and registration credential validation.
- Email fields now reject leading or trailing whitespace and require a valid email format.
- Registration now requires a name and an 8–128 character password.
- Login now requires a non-empty password and displays validation feedback before submitting.
- Added consistent email normalization during registration, login, and password recovery so email casing resolves to the same account.
- Added Sales Agent commission validation in the admin panel.
- Commission values must be between 1% and 50%, inclusive; negative values, 0%, and values above 50% are rejected.
- Invalid commission values remain visible for correction and display a clear error message.

### Changed Files

- `apps/web/app/(storefront)/(auth)/login/page.tsx`
  - Added shared schema validation and inline credential error feedback.

- `apps/web/app/(storefront)/(auth)/signup/page.tsx`
  - Added shared registration validation, required fields, password length constraints, and inline error feedback.

- `apps/web/app/admin/agents/page.tsx`
  - Validated commission values before approval and agent updates.
  - Added error feedback for values outside the 1%–50% range.

- `packages/shared/src/contracts/auth.ts`
  - Added shared strict email validation and email normalization.

- `packages/shared/src/contracts/sales-agent.ts`
  - Changed commission validation from `0%–50%` to `1%–50%`.

- `apps/api/src/modules/auth/auth.service.ts`
  - Applied canonical email lookup and storage for registration, login, and password recovery.

### Verification

- Passed:
  - `pnpm --filter @skillstream/shared test`
  - `pnpm --filter @skillstream/shared typecheck`
  - `pnpm --filter @skillstream/api typecheck`
  - `pnpm --filter @skillstream/web typecheck`

### Fixed

- Fixed the student account menu's `My Learning` navigation after login.
### Notes

- The site-header course search remains submit-based and does not need debounce behavior.

## 2026-08-12

### Fixed

- Fixed the All courses sort select showing raw option values such as `price_high` after selection.
- The sort trigger now displays the selected option label, including `Most popular`, `Highest rated`, `Newest`, `Price: low to high`, and `Price: high to low`.
- Fixed the course detail `Buy now` flow skipping the coupon step by sending users directly to checkout.
- `Buy now` now adds the course to cart and opens the cart coupon section first, so customers can review pricing and apply a coupon before checkout.
- Fixed lesson notes feeling combined across the course by tying the notes panel to the active lesson.
- Each lesson now loads its own saved note, resets the editor when switching lessons, and saves only when the learner clicks the save icon.

### Changed Files

- `apps/web/app/(storefront)/courses/_components/catalog-results.tsx`
  - Added a shared `SORT_OPTIONS` label/value list.
  - Rendered the selected sort label inside `SelectValue` instead of allowing the raw value to appear.
  - Reused the same option list to render `SelectItem` entries.

- `apps/web/app/(storefront)/courses/[slug]/_components/course-purchase-card.tsx`
  - Changed `Buy now` navigation from `/checkout` to `/cart#coupon`.
  - Added a toast that tells customers they can review the cart and apply a coupon before checkout.

- `apps/web/app/(storefront)/cart/page.tsx`
  - Added a `coupon` anchor target around the coupon controls.
  - Added scroll margin so the coupon area lands cleanly below sticky page chrome.

- `apps/web/app/learn/[slug]/_components/learn-client.tsx`
  - Keyed the notes panel by active lesson id so every lesson gets its own note state.
  - Added a save icon button for explicitly saving the current lesson's note.
  - Passed the active lesson title into save feedback so the confirmation matches the lesson being edited.
  - Reset the draft from the saved lesson note whenever learners switch lessons.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`

## 2026-08-11

### Added

- Added password visibility toggles to the login and signup password fields.
- Users can now click the eye button to show or hide the password they typed during sign in or account creation.
- The toggle uses accessible labels that switch between `Show password` and `Hide password`.
- Updated frontend website branding to display `GLS Learning` and use the provided `GLS-Learning.svg` logo asset.

### Fixed

- Fixed cart and checkout summaries briefly showing `$0.00` for subtotal and total after applying a coupon while the server quote refreshes.
- The summaries now keep a catalog-price fallback until the authoritative coupon quote arrives.
- Fixed certificate PDF downloads from the student certificates dashboard returning `404` when the stored PDF URL points at the wrong host or route.
- Fixed the certificate share action so it falls back to copying the public verification link and shows success/error feedback.
- Reworked certificate PDF export to use a browser-rendered print route so the saved PDF uses the exact same certificate component, font, colors, gradients, borders, seal, corner marks, and texture as the dashboard preview.


### Changed Files

- `apps/web/app/(storefront)/(auth)/login/page.tsx`
  - Added `showPassword` state for the password input.
  - Switched the password input type between `password` and `text`.
  - Added Lucide `Eye` and `EyeOff` icons inside a small ghost icon button.
  - Added right padding to the password input so typed text does not overlap the button.

- `apps/web/components/shared/logo.tsx`
  - Replaced the inline SkillStream SVG mark with the provided `/GLS-Learning.svg` asset.
  - Updated visible logo text and accessibility labels to `GLS Learning`.

- Frontend brand copy
  - Updated visible website references from `SkillStream`/`GLS Learning` to `GLS Learning` across metadata, footer, signup, checkout, instructor, teach, account, certificate, verification, course metadata, and video watermark surfaces.

- `apps/web/app/(storefront)/(auth)/signup/page.tsx`
  - Added `showPassword` state for the signup password input.
  - Switched the signup password input type between `password` and `text`.
  - Added Lucide `Eye` and `EyeOff` icons inside a small ghost icon button.
  - Added `autoComplete="new-password"` and right padding for the icon button.

- `apps/web/app/(storefront)/cart/page.tsx`
  - Added explicit cents-based fallback pricing for subtotal, discount, and total.
  - Kept totals stable while coupon quote data is loading or refreshing.

- `apps/web/app/(storefront)/checkout/page.tsx`
  - Added the same catalog-price fallback used by the cart summary.
  - Prevented checkout totals and the pay button amount from falling back to `$0.00` before the quote response arrives.

- `apps/web/app/(student)/dashboard/certificates/page.tsx`
  - Replaced direct `pdfUrl` anchor downloads with the exact-design certificate print route.
  - Added loading state and error feedback when opening the PDF print flow.
  - Improved the share action with native share success feedback, clipboard fallback, and browser-not-supported feedback.

- `apps/web/components/shared/certificate-preview.tsx`
  - Extracted the certificate preview into a shared component used by both the dashboard preview and PDF print route.
  - Kept the certificate design source unified so PDF output does not drift from the preview.
  - Added print sizing and spacing so the certificate fills one A4 landscape page cleanly.
  - Changed print layout from edge-to-edge vertical spacing to a centered composition with tighter seal, signature/date, and serial spacing.

- `apps/web/app/certificates/[serial]/print/page.tsx`
  - Added a standalone public certificate print/PDF route outside storefront chrome.
  - Fetches the certificate by serial and renders the shared certificate preview.
  - Added route-scoped print CSS for A4 landscape output and exact color preservation.
  - Constrained print dimensions and overflow to prevent extra blank pages.

- `apps/web/app/certificates/[serial]/print/print-client.tsx`
  - Added auto-print behavior and a manual `Print / Save PDF` fallback button.
  - Waits for web fonts before opening the print dialog to avoid layout shifts.

- `apps/web/app/(storefront)/verify/[serial]/page.tsx`
  - Updated `View PDF` to open the standalone exact-design print route instead of the approximate API PDF endpoint.

- `apps/api/src/common/utils/pdf.ts`
  - Expanded the certificate PDF renderer to better match the dashboard certificate preview.
  - Added support for filled rectangles and circles in the lightweight PDF writer.
  - Added a subtle dotted security texture, layered borders, center seal, issue details, serial, and verification URL to the certificate PDF.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`
  - `pnpm --filter @skillstream/api typecheck`
  - `pnpm --filter @skillstream/api test src/common/__tests__/pdf.test.ts`

## 2026-08-06

### Fixed

- Fixed the course video area showing a black screen when playback was not actually available or when the fallback frame rendered its overlay incorrectly.
- The protected player now falls back to the unavailable-video state if the API does not provide an iframe URL.
- Fixed rating submission failing with `body: String must contain at least 1 character(s)` when a learner selected stars without writing review text.
- Review text is now optional for course ratings; star rating and title validation still apply.
- Fixed portal sidebar responsiveness so long navigation lists scroll instead of pushing the logout section below the viewport.
- The sidebar header, command palette, and account/logout area now stay visible while only the navigation list scrolls.
- Fixed a Next.js Server Component to Client Component serialization error in the portal navigation.
- The error happened because server layouts were passing Lucide React component functions through the `items` prop into the client-side `PortalShell`.
- Next.js only allows serializable/plain data to cross that boundary, so the icon components caused errors such as:
  - `Only plain objects can be passed to Client Components from Server Components`
  - `Functions cannot be passed directly to Client Components`

### Changed Files

- `apps/web/components/player/protected-player.tsx`
  - Removed the fallback frame overlay that made the course video area appear gray.
  - Added a guard so the component does not render a blank iframe when `iframeUrl` is missing.
  - Added `border-0` to the Cloudflare Stream iframe for cleaner rendering.

- `packages/shared/src/contracts/reviews.ts`
  - Changed `createReviewSchema.body` from requiring at least one character to allowing an empty trimmed string.
  - Kept the existing maximum length validation for written review text.

- `apps/web/app/(storefront)/courses/[slug]/_components/reviews-section.tsx`
  - Updated review rendering so the body paragraph is only shown when written feedback exists.

- `apps/web/app/admin/reviews/page.tsx`
  - Updated admin moderation review rendering so rating-only reviews do not show an empty body paragraph.

- `apps/web/components/shared/portal-shell.tsx`
  - Made the sidebar column use `min-h-0` so its flex children can shrink correctly within the viewport.
  - Added `overflow-y-auto` to the navigation region, allowing long menus like the admin sidebar to scroll independently.
  - Marked the header, command palette, and footer/logout area as `shrink-0` so they remain visible.
  - Added a client-side `navIcons` registry for supported Lucide icons.
  - Added `NavIconName`, derived from the registry keys.
  - Changed `NavItem.icon` from a `LucideIcon` component to a serializable icon-name string.
  - Added `getNavIcon(name)` so client components can resolve icon names to Lucide components.
  - Updated sidebar rendering to resolve the icon locally before rendering.

- `apps/web/components/shared/command-palette.tsx`
  - Updated navigation command generation to call `getNavIcon(it.icon)`.
  - This keeps the command palette compatible with the new serialized `NavItem` shape.

- `apps/web/app/admin/layout.tsx`
  - Removed server-side Lucide imports used only for portal navigation.
  - Replaced icon component references with string keys such as `"LayoutDashboard"`, `"BookOpen"`, and `"GraduationCap"`.

- `apps/web/app/(student)/layout.tsx`
  - Removed server-side Lucide imports used only for portal navigation.
  - Replaced icon component references with string keys such as `"LayoutDashboard"`, `"BarChart3"`, `"Award"`, and `"Settings"`.

- `apps/web/app/instructor/layout.tsx`
  - Replaced portal navigation icon components with string keys.
  - Kept `GraduationCap` imported because it is still rendered directly in the server-side fallback UI.

- `apps/web/app/sales-agent/layout.tsx`
  - Replaced portal navigation icon components with string keys.
  - Kept `Megaphone` imported because it is still rendered directly in the server-side fallback UI.

- `apps/web/app/org/[slug]/layout.tsx`
  - Removed server-side Lucide imports used only for portal navigation.
  - Replaced organization portal navigation icons with string keys.

### Why This Fix Works

- Server Components now pass only plain serializable navigation data:
  - `href`
  - `label`
  - `icon`
  - `exact`
- The client-side `PortalShell` receives those strings and resolves the matching Lucide icon inside the client boundary.
- This preserves the existing UI while respecting the Next.js Server Component serialization rules.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`

- Lint status:
  - `pnpm --filter @skillstream/web lint` completed and failed because of an existing unrelated issue in `apps/web/app/admin/students/page.tsx`.
  - The reported lint error is `react-hooks/set-state-in-effect` at line 37 and was not introduced by this navigation fix.
