import "server-only";
import { cache } from "react";
import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";

/**
 * One QueryClient per server request — React's `cache()` scopes this to a
 * single render pass, so multiple Server Components prefetching during the
 * same request share one client instead of each getting their own.
 *
 * Usage in a Server Component that hands data to a client island:
 *
 *   const queryClient = getQueryClient();
 *   await queryClient.prefetchQuery({ queryKey: qk.catalog, queryFn: ... });
 *   return (
 *     <HydrationBoundary state={dehydrate(queryClient)}>
 *       <ClientIsland />
 *     </HydrationBoundary>
 *   );
 *
 * `ClientIsland`'s `useQuery` with the same query key then resolves from the
 * prefetched cache on mount instead of fetching cold after hydration. This is
 * separate from `serverApi` (lib/api/server.ts), which is for data a Server
 * Component renders directly and never needs — this is specifically for data
 * a *client* subtree also needs via its own `useQuery`.
 */
export const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
        },
        // Suspense-based prefetches leave queries in "pending" state until
        // the client resolves them; dehydrate those too so a page using
        // useSuspenseQuery downstream doesn't lose the in-flight prefetch.
        dehydrate: {
          shouldDehydrateQuery: (query) =>
            defaultShouldDehydrateQuery(query) || query.state.status === "pending",
        },
      },
    }),
);
