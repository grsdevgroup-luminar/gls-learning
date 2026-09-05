"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCategories, useCourses } from "@/lib/api/hooks";
import { useStore } from "@/lib/context/store";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import {
  activeCourseSearchQuery,
  normalizeCourseSearchQuery,
  onCourseSearchInputChange,
} from "@/lib/course-search";
import { CatalogFilters, PRICE_BUCKETS } from "./catalog-filters";
import { CatalogResults } from "./catalog-results";
import { SortSelect } from "./sort-select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal } from "lucide-react";
import { rawPriceCentsForRegionalBound, type CourseLevel, type CourseSort } from "@skillstream/shared";

const SORT_TO_API: Record<string, CourseSort> = {
  popular: "popular",
  rating: "rating",
  newest: "newest",
  price_low: "price_asc",
  price_high: "price_desc",
};

export function CatalogClient() {
  const { data: categories = [] } = useCategories();
  const { region } = useStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = normalizeCourseSearchQuery(searchParams.get("q") ?? "");
  const urlCats = searchParams.getAll("category");

  // Backend `GET /courses` only accepts one category / one level at a time —
  // the filter UI matches that instead of pretending to support multi-select
  // then silently only honoring the first pick.
  const [qInput, setQInput] = useState(urlQ);
  const debouncedQ = useDebouncedSearch(qInput);
  const [urlSearch, setUrlSearch] = useState(activeCourseSearchQuery(urlQ));
  const [cats, setCats] = useState<string[]>(urlCats);
  const [lvl, setLvl] = useState<CourseLevel | null>(null);
  const [price, setPrice] = useState("all");
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState("popular");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Re-searching from the header (`/courses?q=...`) while already on this
  // page changes the URL but not this component's state — pick it up.
  // Adjusted synchronously during render (React's recommended pattern for
  // "sync state to a changing external value") instead of an effect, which
  // would cost an extra render pass and can cascade.
  const [syncedFromUrl, setSyncedFromUrl] = useState({ q: urlQ, cats: urlCats.join("|") });
  const urlCatsKey = urlCats.join("|");
  const urlChanged = syncedFromUrl.q !== urlQ || syncedFromUrl.cats !== urlCatsKey;
  const nextUrlSearch = activeCourseSearchQuery(urlQ);
  if (urlChanged) {
    setSyncedFromUrl({ q: urlQ, cats: urlCatsKey });
    setQInput(urlQ);
    setUrlSearch(nextUrlSearch);
    setCats(urlCats);
  }
  const effectiveQInput = urlChanged ? urlQ : qInput;
  const q =
    activeCourseSearchQuery(effectiveQInput) === (urlChanged ? nextUrlSearch : urlSearch)
      ? (urlChanged ? nextUrlSearch : urlSearch)
      : debouncedQ;

  // Every filter is now server-backed (price/rating included), so any change
  // to any of them resets pagination — the fetched page is always the full,
  // already-filtered result, never something to narrow down further client-side.
  // `region.multiplier` is included because it changes what raw-price bound
  // the current price bucket resolves to below, even if `price` itself didn't change.
  const catKey = cats.join("|");
  const [pagingKey, setPagingKey] = useState({ q, catKey, lvl, price, minRating, sort, m: region.multiplier });
  if (
    pagingKey.q !== q ||
    pagingKey.catKey !== catKey ||
    pagingKey.lvl !== lvl ||
    pagingKey.price !== price ||
    pagingKey.minRating !== minRating ||
    pagingKey.sort !== sort ||
    pagingKey.m !== region.multiplier
  ) {
    setPagingKey({ q, catKey, lvl, price, minRating, sort, m: region.multiplier });
    setPage(1);
  }

  const bucket = PRICE_BUCKETS.find((b) => b.id === price)!;
  // Price buckets are labeled in the *regional* (discounted) price shown on
  // each card — e.g. "Under $30" — but `basePriceCents` on the server is the
  // raw, undiscounted USD price. Convert the bucket's bound into raw terms
  // for this region before querying, or a "$22.99"-displaying course fails
  // an "under $30" filter because its raw price is $64.99.
  const { data: coursePage, isLoading } = useCourses({
    q: q || undefined,
    category: cats.length ? cats : undefined,
    level: lvl ?? undefined,
    minPriceCents:
      bucket.minPriceCents !== undefined
        ? rawPriceCentsForRegionalBound(bucket.minPriceCents, region, "min")
        : undefined,
    maxPriceCents:
      bucket.maxPriceCents !== undefined
        ? rawPriceCentsForRegionalBound(bucket.maxPriceCents, region, "max")
        : undefined,
    minRating: minRating || undefined,
    sort: SORT_TO_API[sort],
    page,
  });

  const items = coursePage?.items ?? [];
  const activeFilterCount =
    (cats.length ? 1 : 0) + (lvl ? 1 : 0) + (price !== "all" ? 1 : 0) + (minRating > 0 ? 1 : 0);

  function clearAllFilters() {
    setQInput("");
    setCats([]);
    setLvl(null);
    setPrice("all");
    setMinRating(0);

    // Keep the shared header search in sync when the catalog was opened with
    // a header query. Local filter state alone cannot clear the header input,
    // which derives its value from the URL.
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("q");
    nextParams.delete("category");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? "/courses?" + nextQuery : "/courses");
  }

  const filterProps = {
    categories,
    q: effectiveQInput,
    onQChange: (value: string) => onCourseSearchInputChange(value, qInput, setQInput),
    cats,
    onCatsChange: setCats,
    lvl,
    onLvlChange: setLvl,
    price,
    onPriceChange: setPrice,
    minRating,
    onMinRatingChange: setMinRating,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">All courses</h1>
        <p className="text-muted-foreground">
          {coursePage?.total ?? 0} course
          {(coursePage?.total ?? 0) !== 1 && "s"} · learn at your own pace
        </p>
      </div>

      {/* Mobile/tablet: filters live in a sheet instead of stacking above the
          grid (that pattern pushes every course below the fold on a phone).
          This sticky bar — Filters + Sort side by side — is the common
          marketplace pattern (Airbnb/Etsy/Amazon mobile) for the same reason. */}
      <div className="sticky top-16 z-20 -mx-4 mb-4 flex items-center gap-2 bg-[#eef0f8] px-4 py-3 dark:bg-background lg:hidden">
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger
            render={<Button variant="outline" className="flex-1 bg-transparent shadow-none" />}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              <CatalogFilters {...filterProps} />
            </div>
          </SheetContent>
        </Sheet>
        <SortSelect value={sort} onChange={setSort} className="flex-1" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:sticky lg:top-16 lg:block lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto">
          <CatalogFilters {...filterProps} />
        </aside>
        <CatalogResults
          coursePage={coursePage}
          items={items}
          isLoading={isLoading}
          sort={sort}
          onSortChange={setSort}
          page={page}
          onPageChange={setPage}
          onClearFilters={clearAllFilters}
        />
      </div>
    </div>
  );
}
