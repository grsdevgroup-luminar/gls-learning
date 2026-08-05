import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { CourseSummaryDto, Paginated } from "@skillstream/shared";
import { getQueryClient } from "@/lib/api/query-client";
import { serverApiCached } from "@/lib/api/server";
import { qs } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { CatalogClient } from "./_components/catalog-client";

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  // Mirrors CatalogClient's initial useCourses() params exactly (q/category
  // from the URL, level unset, default sort/page) so the prefetch below and
  // the client's first render share the same query key and cache-hit instead
  // of the client re-fetching cold after hydration.
  const defaultParams = {
    q: first(sp.q) || undefined,
    category: first(sp.category) ?? undefined,
    level: undefined,
    sort: "popular" as const,
    page: 1,
  };

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: qk.courses(defaultParams),
      queryFn: () =>
        serverApiCached<Paginated<CourseSummaryDto>>(`/courses${qs(defaultParams)}`, 30),
    }),
    queryClient.prefetchQuery({
      queryKey: qk.categories,
      queryFn: () => serverApiCached<string[]>("/categories", 3600),
    }),
  ]);

  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16">Loading courses…</div>}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CatalogClient />
      </HydrationBoundary>
    </Suspense>
  );
}
