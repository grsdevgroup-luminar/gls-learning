# Changelog

## 2026-08-31

### Fixed


- Fixed Student Course category-wise retrieval so recommendations require an exact selected category and match the student's relevant keywords against course titles, subtitles, or descriptions.


### Fixed

- Kept the Course content sidebar independently scrollable.
- Adjusted the desktop split so the video takes most of the available height while the lesson tabs retain a visible minimum area.

- Fixed the course review modal close icon being clipped by the popup overflow boundary.
- Added visible 160-character title and 4,000-character review limits with live counters.

### Changed Files

- `apps/web/app/learn/[slug]/_components/learn-client.tsx`
  - Uses a fixed desktop player shell with a non-scrollable video track.
  - Keeps lesson details and the course-content sidebar as separate scrollable regions.
  - Reserves a visible details area while giving the video the larger share of the viewport.

- `apps/web/components/player/protected-player.tsx`
  - Keeps video and unavailable/loading frames width-driven with a responsive 16:9 ratio.
  - Prevents the player section from introducing its own scrollbar.

- `apps/web/app/(storefront)/courses/[slug]/_components/review-dialog.tsx`
  - Removed popup overflow clipping and added review title/body length feedback.
- `packages/shared/src/contracts/reviews.ts`
  - Added clear review title and body validation messages.

## 2026-08-30

### Fixed

- Made the Instructor Overview welcome and stats section stay sticky at the top of the page.
- Moved the instructor review notice, courses list, and profile teaser into a scrollable content area below the sticky overview summary.
- Fixed Instructor Profile edits for pending applicants by persisting changes to their latest application when no instructor profile row exists yet.
- Added a clear 4,000-character bio limit and live counter to the Instructor Profile form.
- Made the Instructor Profile headline required, limited it to 160 characters, and added a live counter.
- Added multi-category selection to the student course catalog filters.
- Updated catalog requests to return courses matching any selected category.

### Changed Files

- `apps/web/app/instructor/page.tsx`
  - Split the overview page into a fixed-height shell with a sticky summary band and an independently scrollable content section.
- `apps/web/app/instructor/profile/page-client.tsx`
  - Added bio and headline length enforcement, immediate saved-value updates, and visible character feedback.
- `apps/api/src/modules/instructor/instructor.service.ts`
  - Persists profile edits to either the instructor profile or latest application record.
- `packages/shared/src/contracts/instructor.ts`
  - Added user-facing headline and bio length validation messages.
- `apps/web/app/(storefront)/courses/_components/catalog-client.tsx`
  - Tracks multiple selected categories and sends repeated category query parameters.
- `apps/web/app/(storefront)/courses/_components/catalog-filters.tsx`
  - Allows category checkboxes to be selected and cleared independently.
- `apps/api/src/modules/courses/courses.service.ts`
  - Filters catalog courses with an `in` query for multiple categories.
- `packages/shared/src/contracts/catalog.ts`
  - Accepts a category string or an array of categories in course list queries.


- Made the learning video and lesson content fill the available main-column width at different browser zoom levels, removing large empty side gaps.
- Made the learning lesson column and course-content sidebar independently scrollable within the desktop viewport.
- Made the learning video and lesson content fill the available main-column width at different browser zoom levels, removing large empty side gaps.
- Made the learning lesson column and course-content sidebar independently scrollable within the desktop viewport.


## 2026-08-29

### Added

- Added an admin-only student profile view from the Admin Panel Students table.
- Added a `View profile` action for each student.
- Added an admin-safe student profile response containing:
  - Avatar, name, email, phone, country, account status, and join date.
  - Last learning activity date.
  - Course enrollment count, completed-course count, certificate count, and learning streak.
  - Total student spending.
  - Interest categories and keywords.
  - Course-by-course progress, lesson counts, completion status, last activity, and certificate issuance.
- Added loading, empty, and error states for the profile view.

### Changed

- Updated the student profile modal to use a wider responsive layout without changing shared modal sizes.
- Contained horizontal and vertical scrolling inside the student profile modal.
- Added a dedicated, thin, rounded scrollbar design for the profile content area.
- Restored the modal close button visibility while keeping profile content scrolling contained.
- Applied theme-aware modal, surface, text, border, and scrollbar styling for light and dark mode.
- Made profile values dynamic from live student, enrollment, lesson-progress, certificate, and student-profile records rather than static UI values.
- Added explicit completed-lesson and total-lesson counts alongside course progress percentages.
- Refreshes the opened profile query when an admin changes a student's status.

### Changed Files

- `apps/api/src/modules/admin/admin.controller.ts`
  - Added the admin-only `GET /admin/students/:id/profile` endpoint.

- `apps/api/src/modules/admin/admin.repository.ts`
  - Loads the student profile, enrollments, course lessons, completed lesson progress, and certificates.

- `apps/api/src/modules/admin/admin.service.ts`
  - Maps database records into the admin-safe profile response and calculates course progress and student metrics.

- `packages/shared/src/contracts/admin.ts`
  - Added the `AdminStudentProfileDto` contract.

- `apps/web/lib/api/endpoints.ts`
  - Added the student profile API client and grouped admin API helper.

- `apps/web/app/admin/students/page-client.tsx`
  - Added the profile action, responsive profile modal, dynamic metrics, course progress display, and modal states.

- `apps/web/app/globals.css`
  - Added profile-modal-only scrollbar styling with light/dark theme-aware colors.

### Data Privacy

- The admin profile response intentionally excludes passwords, password hashes, notification preferences, private lesson notes, refresh tokens, and other non-operational account data.

### Verification

- Passed:
  - `pnpm --filter @skillstream/shared build`
  - `pnpm --filter @skillstream/api typecheck`
  - `pnpm --filter @skillstream/api build`
  - `pnpm --filter @skillstream/web typecheck`
  - `git diff --check`

## 2026-08-28

### Fixed

- Replaced the unclear empty-name validation feedback in the Student Profile with the user-friendly message `Name is required. Please enter your name.`
- Prevented the Student Profile save request from being sent when the name field is empty.
- Applied the same clear message to shared API validation for empty profile names.

### Changed Files

- `apps/web/app/(student)/account/page-client.tsx`
  - Validates that a name is entered before saving the profile.

- `packages/shared/src/contracts/authoring.ts`
  - Added a clear validation message for empty profile names.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`
  - `pnpm --filter @skillstream/shared typecheck`

## 2026-08-28

### Fixed

- Replaced the unclear missing-phone validation feedback in the Student Profile with the user-friendly message `Please enter your phone number.`
- Added a clear phone-format message for values that are present but invalid.
- Prevented the Student Profile save request from being sent when the phone field is empty.

### Changed Files

- `apps/web/app/(student)/account/page-client.tsx`
  - Validates that a phone number is entered before saving the profile.

- `packages/shared/src/contracts/authoring.ts`
  - Updated the phone-format validation message to use plain language.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`
  - `pnpm --filter @skillstream/shared typecheck`

## 2026-08-28

### Fixed

- Fixed the Student Change Password current-password visibility control so the entered current password is revealed reliably when toggled.
- Added explicit current/new password autocomplete semantics and field associations for the visibility controls.
- Preserved field focus while toggling visibility and kept the three password fields independently controlled.

### Changed Files

- `apps/web/app/(student)/account/page-client.tsx`
  - Added stable field IDs, autocomplete values, `aria-controls`, and focus-preserving visibility-toggle behavior.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`

## 2026-08-28

### Added

- Added password visibility controls to the Student Change Password form.
- Students can independently show or hide the current password, new password, and confirmation password fields.
- Added accessible labels and pressed-state semantics to each visibility control while preserving input spacing and security defaults.

### Changed Files

- `apps/web/app/(student)/account/page-client.tsx`
  - Added independent visibility state and accessible Eye/EyeOff toggle buttons for all password fields.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`

## 2026-08-28

### Fixed

- Preserved the learner name recorded when a certificate is issued so later Student Profile name changes no longer alter previously issued certificates.
- Updated certificate previews, downloads, and public verification to use the stored certificate name snapshot.
- Added a server-side restriction allowing each account to change its name a maximum of two times.
- Existing certificates are backfilled with the learner name associated with their enrollment during migration.

### Changed Files

- `apps/api/prisma/schema.prisma`
  - Added `Certificate.learnerName` and `User.nameChangeCount` fields.

- `apps/api/prisma/migrations/20260828000000_preserve_certificate_learner_name/migration.sql`
  - Adds the certificate name snapshot and name-change counter.
  - Backfills certificate names from the current enrollment user before enforcing the non-null constraint.

- `apps/api/src/modules/enrollment/enrollment.service.ts`
- `apps/api/src/modules/enrollment/enrollment.repository.ts`
  - Captures the learner name only when a certificate is first created and returns the stored name for certificate responses.

- `apps/api/src/modules/certificates/certificates.service.ts`
- `apps/api/src/modules/certificates/certificates.repository.ts`
  - Uses the stored certificate name for public verification and PDF generation.

- `apps/api/src/modules/auth/auth.service.ts`
  - Rejects name changes after the account reaches the two-change limit.

- `packages/shared/src/contracts/enrollment.ts`
- `apps/web/lib/api/endpoints.ts`
- `apps/web/app/(student)/dashboard/certificates/page-client.tsx`
  - Exposes and renders the immutable certificate learner name.

### Verification

- Passed:
  - `pnpm --filter @skillstream/shared typecheck`
  - `pnpm --filter @skillstream/api typecheck`
  - `pnpm --filter @skillstream/web typecheck`

## 2026-08-28

### Fixed

- Centered the account role label inside its header box across all portal modules.
- Admin, Instructor, Student, Sales Agent, and Company Admin labels now use consistent horizontal and vertical alignment.

### Changed Files

- `apps/web/components/shared/portal-shell.tsx`
  - Added centered flex alignment and text alignment to the shared role badge.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`

## 2026-08-28

### Fixed

- Fixed the instructor portal header notification bell overlapping the `Instructor` account label.
- Constrained the role label within the available sidebar-header width and reduced the header-only logo size so the role label, notification bell, and theme toggle remain separated and aligned.

### Changed Files

- `apps/web/components/shared/portal-shell.tsx`
  - Made the role label shrink and truncate when necessary.
  - Used a compact header logo size to keep all header controls within the sidebar width.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`

## 2026-08-28

### Fixed

- Updated the Student Change Password `Update password` button to use the standard primary button color and styling used throughout the system.
- Removed the inconsistent outline variant while preserving the existing loading, disabled, and submit behavior.

### Changed Files

- `apps/web/app/(student)/account/page-client.tsx`
  - Uses the shared default button variant for `Update password`, matching the account page's other primary actions.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`

## 2026-08-28

### Fixed

- Fixed the instructor portal header role label and notification bell appearing on different vertical alignments.
- Matched the role label height to the adjacent icon controls and vertically centered its text for consistent portal-header alignment.

### Changed Files

- `apps/web/components/shared/portal-shell.tsx`
  - Updated the portal role badge to use a fixed 32px height with centered content, matching the notification and theme-toggle controls.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`

## 2026-08-28

### Fixed

- Implemented password-format validation across password creation and update flows.
- Passwords must contain at least 8 characters and at least one special character.
- Reused the shared password schema for student change-password requests so the frontend and API enforce the same requirements.
- Added immediate validation feedback to the Student Change Password and Reset Password forms before submitting a request.
- Registration and password-reset API validation also use the strengthened shared password requirements.

### Changed Files

- `packages/shared/src/contracts/auth.ts`
  - Added the special-character requirement to the canonical `passwordSchema` while retaining the existing 8-character minimum and 128-character maximum.

- `packages/shared/src/contracts/authoring.ts`
  - Updated `changePasswordSchema` to reuse the canonical password schema instead of maintaining separate length-only rules.

- `apps/web/app/(student)/account/page-client.tsx`
  - Validates the new password with the shared schema before submitting the Student Change Password form.
  - Displays the relevant password requirement when validation fails.

- `apps/web/app/(storefront)/(auth)/reset-password/page.tsx`
  - Validates the new password with the shared schema before submitting the Reset Password form.
  - Displays the relevant password requirement when validation fails.

### Verification

- Passed:
  - `pnpm --filter @skillstream/shared build`
  - `pnpm --filter @skillstream/shared typecheck`
  - `pnpm --filter @skillstream/web typecheck`

## 2026-08-25

### Fixed

- Fixed main navigation course search redirecting back to the search results when a student opened a selected course.
- Prevented stale debounced header search state from replaying after navigation to a course details page.

### Changed Files

`apps\web\components\layout\site-header.tsx`
- Added a route-transition guard so only the current header query can trigger automatic search navigation.
- Course cards selected from main search results now remain on their `/courses/[slug]` details page.

### Verification

- Passed: `pnpm --filter @skillstream/web typecheck`

## 2026-08-23

### Fixed

- Fixed an issue where text in the course builder would bleed underneath the sticky header during scrolling by separating the header and content areas and applying a solid background.

-Fixed the Orders table scrolling behavior so that column headers remain sticky and fixed at the top while only the table data scrolls vertically underneath them.

### Changed Files
`apps\web\components\shared\course-builder.tsx`
- Updated the course builder top navigation into a unified, full-width header that groups the course title context and save actions together.

-Restructured the desktop course builder into a fixed-height, dual-scroll layout, allowing the main curriculum editor (left column) and the publishing/settings sidebar (right column) to scroll independently.

-Adjusted layout constraints so the independent scrolling panes apply only to large screens, preserving standard full-page scrolling for mobile and tablet devices.

-Improved spacing and padding within the scrollable content wrapper so scrollbars align perfectly with the screen edge without overlapping the form cards.

`apps\web\app\admin\orders\page.tsx`
-Restructured the Orders page layout into a fixed-height container with an internal scrollable table container to support data-heavy viewing seamlessly.

-Upgraded the bottom pagination bar to a standard multi-page pattern featuring numerical page buttons, ellipsis handling for large page ranges, and clear current-page indicators.

-Ensured rows-per-page selections and search filters work reliably alongside the newly integrated sticky layout and pagination controls.

`apps\web\app\admin\_components\admin-pagination.tsx`
- Added shared admin pagination controls with `Previous`, numbered pages, ellipsis ranges, and `Next`.

- Added a shared `Rows per page` selector with consistent options across admin lists.

- Added an option for list pages to show pagination even when there is only one page.

`apps\web\app\admin\_components\admin-table.tsx`
- Added a shared scrollable admin table wrapper so table data can scroll independently while headers remain visible.

- Added shared sticky table header classes for consistent admin table behavior.

- Added full-height scroll support so fixed-height portal pages can make the table region fill the remaining space and scroll internally.

`apps\web\app\admin\courses\page.tsx`
- Updated course list pagination and rows-per-page controls to use the shared admin pattern.

- Made course table headers sticky while table rows scroll.

- Aligned the courses list page shell with the Orders table layout so controls, table scrolling, and pagination behave consistently.

`apps\web\app\admin\students\page.tsx`
- Added rows-per-page support to the students query and list controls.

- Updated students pagination to the shared numbered admin pattern.

- Made student table headers sticky while table rows scroll.

- Removed the nested table scroll wrapper so the students table has a single vertical scrollbar.

`apps\web\app\admin\coupons\page.tsx`
- Updated coupon list pagination and rows-per-page controls to use the shared admin pattern.

- Aligned coupon pagination with the same numbered controls used by other admin lists.

`apps\web\app\admin\agents\page.tsx`
- Added rows-per-page and numbered pagination controls to the All agents table.

- Aligned the Sales Agents page structure with the Students page: fixed-height portal layout, stats at the top, search/rows controls above the table, table card, and pagination footer.

- Made the All agents table header cells sticky inside the table scroll container while agent rows scroll.

- Reordered the Sales Agents controls to follow the Students pattern with search on the left and rows-per-page on the right.

- Made the All agents table card fill the remaining page height and scroll internally.

- Kept the All agents pagination visible even when the filtered result fits on one page.

`apps\web\app\sales-agent\referrals\page.tsx`
- Added rows-per-page and numbered pagination controls to the referrals table.

- Made the referrals table header sticky while referral rows scroll.

`apps\web\app\sales-agent\earnings\page.tsx`
- Added rows-per-page and numbered pagination controls to paid and pending commission tables.

- Made earnings table headers sticky while commission rows scroll.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`



## 2026-08-22

### Fixed

- Fixed the profile/account menu hover cursor so the storefront header profile icon and shared portal account menu show a hand pointer.
- Updated shared button and dropdown-menu item styling so other clickable dropdown triggers and menu actions also expose pointer cursor feedback consistently.
- Fixed duplicate course-search requests when the top navigation search submitted while already on the courses page.
- Navigation search now updates the course results dynamically after typing pauses, including removing the query when the search is cleared; Enter remains supported as an immediate submit.
- Certificate PDF generation now stays in the current tab, and the print view Back action returns directly to the Certificates dashboard section.
- Certificate print navigation now creates a reliable browser history entry, so the browser Back button returns to Certificates instead of skipping to My progress.
- The certificate print view now inserts the Certificates section directly before its print entry, covering cases where the browser history previously contained another student dashboard page.
- Removed forced new-tab navigation from certificate verification and PDF links so certificate actions remain in one tab.
- Header-submitted course searches now apply immediately in the course filters without an intermediate old-query fetch, and hydrated course results stay fresh long enough to avoid an immediate client refetch.
- The top navigation search field now syncs with the active `/courses?q=...` value and skips navigation when the submitted course-search URL is unchanged.
- Fixed the My Progress completed-course Review action so it opens the public course page directly at the Write a review area instead of routing learners back into the course player.
- Added a stable `write-a-review` anchor around the course review action so hash navigation scrolls to the exact review button location.
- Fixed the review dialog layout so long title or review text stays inside the modal instead of expanding the text fields beyond the dialog width.
- Added Daily, Weekly, and Monthly activity views to My Progress with a period selector.
- Clarified that activity is calculated from completed lesson duration, and that course progress is completed lessons divided by total lessons.

### Changed Files

- `apps/web/components/layout/site-header.tsx`
  - Syncs the header search input with the active course search URL and avoids same-URL course search navigations.

- `apps/web/app/(storefront)/courses/_components/catalog-client.tsx`
  - Applies URL-originated search terms immediately while preserving debounced search for direct course filter typing.

- `apps/web/lib/api/query-keys.ts`
  - Normalizes course query keys by removing empty and undefined params before React Query hashes them.

- `apps/web/lib/api/hooks.ts`
  - Reuses normalized course params for fetches and keeps course list data fresh briefly after server hydration.

- `apps/web/components/ui/button.tsx`
  - Added pointer cursor styling to the shared button primitive used by the storefront profile trigger and other button-based dropdown triggers.

- `apps/web/components/ui/dropdown-menu.tsx`
  - Changed enabled dropdown menu actions from default cursor to pointer cursor.

- `apps/web/components/shared/portal-shell.tsx`
  - Added pointer cursor styling to the shared sidebar profile/account menu trigger used across portal modules.

- `apps/web/app/(student)/dashboard/certificates/page.tsx`
  - Opens the certificate print/download view in the current tab and keeps verification navigation in the same tab.

- `apps/web/app/certificates/[serial]/print/print-client.tsx`
  - Routes the print view Back action directly to the student Certificates section.

- `apps/web/app/(storefront)/verify/[serial]/page.tsx`
  - Keeps the public certificate PDF action in the current tab.

- `apps/web/app/(student)/dashboard/progress/page.tsx`
  - Routes completed-course Review actions to `/courses/[slug]#write-a-review` while keeping incomplete courses on the existing Resume path.

- `apps/web/app/(storefront)/courses/[slug]/_components/reviews-section.tsx`
  - Adds the `write-a-review` anchor and scroll margin around the enrolled learner review action.

- `apps/web/app/(storefront)/courses/[slug]/_components/review-dialog.tsx`
  - Constrains the review modal and form controls, keeping long unbroken text wrapped or scrollable inside the title and review fields.

- `apps/web/app/(student)/dashboard/progress/page.tsx`
  - Adds the Daily, Weekly, and Monthly activity selector, period totals, active-day counts, and progress calculation guidance.

- `apps/web/lib/api/hooks.ts`
  - Loads activity for the selected time period and caches each period independently.

- `apps/web/lib/api/endpoints.ts`
  - Requests learner activity through the period-aware activity endpoint.

- `apps/web/lib/api/query-keys.ts`
  - Adds period-specific activity query keys.

- `apps/api/src/modules/enrollment/enrollment.controller.ts`
  - Exposes the learner activity endpoint with Daily, Weekly, and Monthly period selection.

- `apps/api/src/modules/enrollment/enrollment.service.ts`
  - Aggregates completed lesson duration across the selected 1-day, 7-day, or 30-day range.

- `apps/api/src/modules/enrollment/enrollment.repository.ts`
  - Generalizes lesson-progress lookup for period-based activity ranges.

- `packages/shared/src/contracts/enrollment.ts`
  - Adds shared activity period and day response types.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`

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
- Course descriptions are limited to 2,000 characters. The editor shows a live count, an inline validation message, and blocks saves until the description is within the limit.
- Description validation now returns `Description cannot exceed 2000 characters` instead of surfacing a generic internal-server error.

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
  - Adds shared-limit description validation, an accessible inline error, character count, and friendly save-error fallback.

- `packages/shared/src/contracts/authoring.ts`
  - Defines and enforces the 2,000-character course-description limit for create and update API requests.

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
- Fixed intermittent role redirects after login by prioritizing the authenticated role over stale 
ext` paths.
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
  - Added a client-side 
avIcons` registry for supported Lucide icons.
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

## 2026-08-26

### Changed

- Consolidated Admin category selection and category management into the Course Builder category dropdown.
- Admins can now search, select, add, approve, edit, and remove categories from one unified category list.
- Active categories remain selectable, while pending categories can be approved directly from the same list.
- Removed the separate Admin Categories page and its sidebar navigation entry because category operations are now handled inside the course category selector.
- Kept the category API operations because they are still required by the embedded Admin controls.
- Restricted the course preference modal on the dashboard to Student accounts only.
- Signup can still display the course preference modal so new learners can choose their interests.

### Changed Files

- `apps/web/components/shared/category-picker.tsx`
  - Added Admin category loading and management actions to the existing picker.
  - Unified category selection and management into one scrollable list.
  - Added inline add, approve, edit, and remove operations for Admin users.

- `apps/web/components/shared/course-builder.tsx`
  - Enables category management when the builder is used in Admin mode.

- `apps/web/components/shared/course-preferences-modal.tsx`
  - Added Student-only visibility support through the `studentOnly` prop and session-role validation.

- `apps/web/app/(student)/dashboard/dashboard-client.tsx`
  - Marks the dashboard preference modal as Student-only.

- `apps/web/app/admin/layout.tsx`
  - Removed the separate Categories sidebar item.

- `apps/web/app/admin/categories/page.tsx`
- `apps/web/app/admin/categories/page-client.tsx`
  - Removed the redundant Admin Categories route and page implementation.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`
  - `pnpm --filter @skillstream/web build`

## 2026-08-26

### Changed

- Added confirmation prompts before destructive actions throughout the frontend.
- Users must confirm before deleting courses, coupons, automation rules, pricing tiers, quiz questions, or removing categories, organization members, organization courses, cart items, course sections, lessons, resources, and course images.
- Added a reusable confirmation dialog for category removal inside the unified Admin course category picker.
- Kept the existing mutation behavior unchanged after confirmation is accepted.

### Changed Files

- `apps/web/components/shared/confirm-dialog.tsx`
  - Added a reusable confirmation dialog component with Cancel and Delete actions.

- `apps/web/components/shared/category-picker.tsx`
  - Added confirmation before removing a category.

- `apps/web/components/shared/course-builder.tsx`
- `apps/web/components/shared/quiz-editor.tsx`
- `apps/web/app/admin/courses/page-client.tsx`
- `apps/web/app/admin/coupons/page-client.tsx`
- `apps/web/app/admin/marketing/page-client.tsx`
- `apps/web/app/admin/pricing/page-client.tsx`
- `apps/web/app/org/[slug]/courses/page-client.tsx`
- `apps/web/app/org/[slug]/members/page-client.tsx`
- `apps/web/app/(storefront)/cart/page.tsx`
  - Added confirmation prompts before destructive actions.

### Verification

- Passed:
  - `pnpm --filter @skillstream/web typecheck`
