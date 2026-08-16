"use client";

import { CourseCard } from "../../_components/course-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Paginated, CourseSummaryDto } from "@skillstream/shared";

const SORT_OPTIONS = [
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Highest rated" },
  { value: "newest", label: "Newest" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
] as const;

export function CatalogResults({
  coursePage,
  items,
  isLoading,
  sort,
  onSortChange,
  page,
  onPageChange,
  onClearFilters,
}: {
  coursePage: Paginated<CourseSummaryDto> | undefined;
  items: CourseSummaryDto[];
  isLoading: boolean;
  sort: string;
  onSortChange: (v: string) => void;
  page: number;
  onPageChange: (updater: (p: number) => number) => void;
  onClearFilters: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Select value={sort} onValueChange={(v) => v && onSortChange(v)}>
          <SelectTrigger className="w-48">
            <SelectValue>
              {SORT_OPTIONS.find((option) => option.value === sort)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          No courses match your filters.
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear all filters
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
          {coursePage && coursePage.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange((p) => Math.max(1, p - 1))}
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
                onClick={() => onPageChange((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
