# Changelog

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
