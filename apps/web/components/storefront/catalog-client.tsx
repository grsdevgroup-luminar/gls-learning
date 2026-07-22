"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCategories, useCourses } from "@/lib/api/hooks";
import { toLegacyCourse, LEVEL_TO_API } from "@/lib/api/adapters";
import { CourseCard } from "@/components/storefront/course-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import type { Level } from "@/types";
import type { CourseSort } from "@skillstream/shared";

const levels: Level[] = ["Beginner", "Intermediate", "Advanced", "All Levels"];
const priceBuckets = [
  { id: "all", label: "Any price", test: () => true },
  { id: "lt30", label: "Under $30", test: (p: number) => p < 30 },
  { id: "30to70", label: "$30 – $70", test: (p: number) => p >= 30 && p <= 70 },
  { id: "gt70", label: "Over $70", test: (p: number) => p > 70 },
];
const SORT_TO_API: Record<string, CourseSort> = {
  popular: "popular",
  rating: "rating",
  newest: "newest",
  price_low: "price_asc",
  price_high: "price_desc",
};

export function CatalogClient() {
  const { data: categories = [] } = useCategories();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  // Backend `GET /courses` only accepts one category / one level at a time —
  // the filter UI matches that instead of pretending to support multi-select
  // then silently only honoring the first pick.
  const [cat, setCat] = useState<string | null>(params.get("category"));
  const [lvl, setLvl] = useState<Level | null>(null);
  const [price, setPrice] = useState("all");
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState("popular");
  const [page, setPage] = useState(1);

  // Re-searching from the header (`/courses?q=...`) while already on this
  // page changes the URL but not this component's initial state — pick it up.
  useEffect(() => {
    setQ(params.get("q") ?? "");
    setCat(params.get("category"));
  }, [params]);

  // Any change to a server-backed filter resets pagination.
  useEffect(() => setPage(1), [q, cat, lvl, sort]);

  const { data: coursePage, isLoading } = useCourses({
    q: q || undefined,
    category: cat ?? undefined,
    level: lvl ? LEVEL_TO_API[lvl] : undefined,
    sort: SORT_TO_API[sort],
    page,
  });

  const fetchedCourses = useMemo(
    () => (coursePage?.items ?? []).map(toLegacyCourse),
    [coursePage],
  );

  // Price/rating aren't in the backend's filter contract — refine within the
  // fetched page client-side (a page at a time, not the whole catalog).
  const filtered = useMemo(() => {
    const bucket = priceBuckets.find((b) => b.id === price)!;
    return fetchedCourses.filter(
      (c) => bucket.test(c.basePrice) && c.rating >= minRating,
    );
  }, [fetchedCourses, price, minRating]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">All courses</h1>
        <p className="text-muted-foreground">
          {coursePage?.total ?? filtered.length} course{(coursePage?.total ?? filtered.length) !== 1 && "s"} · learn at your own pace
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* Filters */}
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" />
          </div>

          <FilterGroup title="Category">
            {categories.map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={cat === c} onCheckedChange={() => setCat(cat === c ? null : c)} />
                {c}
              </label>
            ))}
          </FilterGroup>

          <FilterGroup title="Level">
            {levels.map((l) => (
              <label key={l} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={lvl === l} onCheckedChange={() => setLvl(lvl === l ? null : l)} />
                {l}
              </label>
            ))}
          </FilterGroup>

          <FilterGroup title="Price">
            {priceBuckets.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="price"
                  checked={price === b.id}
                  onChange={() => setPrice(b.id)}
                  className="accent-primary"
                />
                {b.label}
              </label>
            ))}
          </FilterGroup>

          <FilterGroup title="Rating">
            {[4.5, 4, 3].map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rating"
                  checked={minRating === r}
                  onChange={() => setMinRating(r)}
                  className="accent-primary"
                />
                {r}+ stars
              </label>
            ))}
            <button
              className="text-left text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setMinRating(0)}
            >
              Clear rating
            </button>
          </FilterGroup>
        </aside>

        {/* Results */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" /> Sort
            </span>
            <Select value={sort} onValueChange={(v) => v && setSort(v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most popular</SelectItem>
                <SelectItem value="rating">Highest rated</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price_low">Price: low to high</SelectItem>
                <SelectItem value="price_high">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              No courses match your filters.
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => { setQ(""); setCat(null); setLvl(null); setPrice("all"); setMinRating(0); }}>
                  Clear all filters
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
              {coursePage && coursePage.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {coursePage.page} of {coursePage.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= coursePage.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-2 block text-sm font-semibold">{title}</Label>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
