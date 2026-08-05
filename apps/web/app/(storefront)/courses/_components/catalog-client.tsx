"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCategories, useCourses } from "@/lib/api/hooks";
import { CatalogFilters, PRICE_BUCKETS } from "./catalog-filters";
import { CatalogResults } from "./catalog-results";
import type { CourseLevel, CourseSort } from "@skillstream/shared";

const SORT_TO_API: Record<string, CourseSort> = {
  popular: "popular",
  rating: "rating",
  newest: "newest",
  price_low: "price_asc",
  price_high: "price_desc",
};

export function CatalogClient() {
  const { data: categories = [] } = useCategories();
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

  // Any change to a server-backed filter resets pagination — same pattern.
  const [pagingKey, setPagingKey] = useState({ q, cat, lvl, sort });
  if (pagingKey.q !== q || pagingKey.cat !== cat || pagingKey.lvl !== lvl || pagingKey.sort !== sort) {
    setPagingKey({ q, cat, lvl, sort });
    setPage(1);
  }

  const { data: coursePage, isLoading } = useCourses({
    q: q || undefined,
    category: cat ?? undefined,
    level: lvl ?? undefined,
    sort: SORT_TO_API[sort],
    page,
  });

  // Price/rating aren't in the backend's filter contract — refine within the
  // fetched page client-side (a page at a time, not the whole catalog).
  const filtered = useMemo(() => {
    const fetchedCourses = coursePage?.items ?? [];
    const bucket = PRICE_BUCKETS.find((b) => b.id === price)!;
    return fetchedCourses.filter(
      (c) => bucket.test(c.basePriceCents / 100) && c.ratingAvg >= minRating,
    );
  }, [coursePage, price, minRating]);

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
          {coursePage?.total ?? filtered.length} course
          {(coursePage?.total ?? filtered.length) !== 1 && "s"} · learn at your own pace
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
          filtered={filtered}
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
