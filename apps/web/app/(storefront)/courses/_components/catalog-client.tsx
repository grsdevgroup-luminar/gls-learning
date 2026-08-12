"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCategories, useCourses } from "@/lib/api/hooks";
import { useStore } from "@/lib/context/store";
import { CatalogFilters, PRICE_BUCKETS } from "./catalog-filters";
import { CatalogResults } from "./catalog-results";
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
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";
  const urlCat = searchParams.get("category");

  // Backend `GET /courses` only accepts one category / one level at a time —
  // the filter UI matches that instead of pretending to support multi-select
  // then silently only honoring the first pick.
  const [q, setQ] = useState(urlQ);
  const [cat, setCat] = useState<string | null>(urlCat);
  const [lvl, setLvl] = useState<CourseLevel | null>(null);
  const [price, setPrice] = useState("all");
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState("popular");
  const [page, setPage] = useState(1);

  // Re-searching from the header (`/courses?q=...`) while already on this
  // page changes the URL but not this component's state — pick it up.
  // Adjusted synchronously during render (React's recommended pattern for
  // "sync state to a changing external value") instead of an effect, which
  // would cost an extra render pass and can cascade.
  const [syncedFromUrl, setSyncedFromUrl] = useState({ q: urlQ, cat: urlCat });
  if (syncedFromUrl.q !== urlQ || syncedFromUrl.cat !== urlCat) {
    setSyncedFromUrl({ q: urlQ, cat: urlCat });
    setQ(urlQ);
    setCat(urlCat);
  }

  // Every filter is now server-backed (price/rating included), so any change
  // to any of them resets pagination — the fetched page is always the full,
  // already-filtered result, never something to narrow down further client-side.
  // `region.multiplier` is included because it changes what raw-price bound
  // the current price bucket resolves to below, even if `price` itself didn't change.
  const [pagingKey, setPagingKey] = useState({ q, cat, lvl, price, minRating, sort, m: region.multiplier });
  if (
    pagingKey.q !== q ||
    pagingKey.cat !== cat ||
    pagingKey.lvl !== lvl ||
    pagingKey.price !== price ||
    pagingKey.minRating !== minRating ||
    pagingKey.sort !== sort ||
    pagingKey.m !== region.multiplier
  ) {
    setPagingKey({ q, cat, lvl, price, minRating, sort, m: region.multiplier });
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
    category: cat ?? undefined,
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

  function clearAllFilters() {
    setQ("");
    setCat(null);
    setLvl(null);
    setPrice("all");
    setMinRating(0);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">All courses</h1>
        <p className="text-muted-foreground">
          {coursePage?.total ?? 0} course
          {(coursePage?.total ?? 0) !== 1 && "s"} · learn at your own pace
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <CatalogFilters
          categories={categories}
          q={q}
          onQChange={setQ}
          cat={cat}
          onCatChange={setCat}
          lvl={lvl}
          onLvlChange={setLvl}
          price={price}
          onPriceChange={setPrice}
          minRating={minRating}
          onMinRatingChange={setMinRating}
        />
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
