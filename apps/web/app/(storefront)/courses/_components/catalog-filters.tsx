"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { CourseLevel, MAX_COURSE_SEARCH_LENGTH, MIN_COURSE_SEARCH_LENGTH } from "@skillstream/shared";
import { levelLabel } from "@/lib/format";

export const LEVELS: CourseLevel[] = [
  CourseLevel.BEGINNER,
  CourseLevel.INTERMEDIATE,
  CourseLevel.ADVANCED,
  CourseLevel.ALL_LEVELS,
];
// Boundaries mirror the backend's `minPriceCents`/`maxPriceCents` filter
// exactly (whole-cent integers) so the label matches what the server returns.
export const PRICE_BUCKETS = [
  { id: "all", label: "Any price", minPriceCents: undefined, maxPriceCents: undefined },
  { id: "lt30", label: "Under $30", minPriceCents: undefined, maxPriceCents: 2999 },
  { id: "30to70", label: "$30 – $70", minPriceCents: 3000, maxPriceCents: 7000 },
  { id: "gt70", label: "Over $70", minPriceCents: 7001, maxPriceCents: undefined },
] as const;

export function CatalogFilters({
  categories,
  q,
  onQChange,
  cats,
  onCatsChange,
  lvl,
  onLvlChange,
  price,
  onPriceChange,
  minRating,
  onMinRatingChange,
}: {
  categories: string[];
  q: string;
  onQChange: (v: string) => void;
  cats: string[];
  onCatsChange: (v: string[]) => void;
  lvl: CourseLevel | null;
  onLvlChange: (v: CourseLevel | null) => void;
  price: string;
  onPriceChange: (v: string) => void;
  minRating: number;
  onMinRatingChange: (v: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder="Search…"
          className="pl-9"
          minLength={MIN_COURSE_SEARCH_LENGTH}
          maxLength={MAX_COURSE_SEARCH_LENGTH}
        />
      </div>

      <FilterGroup title="Category">
        {categories.map((c) => (
          <label key={c} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={cats.includes(c)} onCheckedChange={() => onCatsChange(cats.includes(c) ? cats.filter((selected) => selected !== c) : [...cats, c])} />
            {c}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup title="Level">
        {LEVELS.map((l) => (
          <label key={l} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={lvl === l} onCheckedChange={() => onLvlChange(lvl === l ? null : l)} />
            {levelLabel(l)}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup title="Price">
        {PRICE_BUCKETS.map((b) => (
          <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="price"
              checked={price === b.id}
              onChange={() => onPriceChange(b.id)}
              className="accent-primary"
            />
            {b.label}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup title="Rating">
        <p className="text-xs text-muted-foreground">Show courses rated at least:</p>
        {[4.5, 4, 3].map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="rating"
              checked={minRating === r}
              onChange={() => onMinRatingChange(r)}
              className="accent-primary"
            />
            {r.toFixed(1)} stars and above
          </label>
        ))}
        <button
          className="text-left text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onMinRatingChange(0)}
        >
          Clear rating
        </button>
      </FilterGroup>
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
