"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { publishedCourses, categories } from "@/lib/mock/courses";
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
import { Search, SlidersHorizontal } from "lucide-react";
import type { Level } from "@/types";

const levels: Level[] = ["Beginner", "Intermediate", "Advanced", "All Levels"];
const priceBuckets = [
  { id: "all", label: "Any price", test: () => true },
  { id: "lt30", label: "Under $30", test: (p: number) => p < 30 },
  { id: "30to70", label: "$30 – $70", test: (p: number) => p >= 30 && p <= 70 },
  { id: "gt70", label: "Over $70", test: (p: number) => p > 70 },
];

export function CatalogClient() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [cats, setCats] = useState<string[]>(
    params.get("category") ? [params.get("category") as string] : [],
  );
  const [lvls, setLvls] = useState<Level[]>([]);
  const [price, setPrice] = useState("all");
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState("popular");

  const filtered = useMemo(() => {
    const bucket = priceBuckets.find((b) => b.id === price)!;
    const out = publishedCourses.filter((c) => {
      if (q && !`${c.title} ${c.subtitle} ${c.category}`.toLowerCase().includes(q.toLowerCase()))
        return false;
      if (cats.length && !cats.includes(c.category)) return false;
      if (lvls.length && !lvls.includes(c.level)) return false;
      if (!bucket.test(c.basePrice)) return false;
      if (c.rating < minRating) return false;
      return true;
    });
    out.sort((a, b) => {
      switch (sort) {
        case "rating": return b.rating - a.rating;
        case "newest": return +new Date(b.updatedAt) - +new Date(a.updatedAt);
        case "price_low": return a.basePrice - b.basePrice;
        case "price_high": return b.basePrice - a.basePrice;
        default: return b.studentCount - a.studentCount;
      }
    });
    return out;
  }, [q, cats, lvls, price, minRating, sort]);

  function toggle<T>(list: T[], value: T, set: (v: T[]) => void) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">All courses</h1>
        <p className="text-muted-foreground">
          {filtered.length} course{filtered.length !== 1 && "s"} · learn at your own pace
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
            {categories.map((cat) => (
              <label key={cat} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={cats.includes(cat)} onCheckedChange={() => toggle(cats, cat, setCats)} />
                {cat}
              </label>
            ))}
          </FilterGroup>

          <FilterGroup title="Level">
            {levels.map((lvl) => (
              <label key={lvl} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={lvls.includes(lvl)} onCheckedChange={() => toggle(lvls, lvl, setLvls)} />
                {lvl}
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

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              No courses match your filters.
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => { setQ(""); setCats([]); setLvls([]); setPrice("all"); setMinRating(0); }}>
                  Clear all filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
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
