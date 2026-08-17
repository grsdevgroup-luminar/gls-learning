"use client";

import { CourseCard } from "../../_components/course-card";
import { Button } from "@/components/ui/button";
import { SortSelect } from "./sort-select";
import { SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import type { Paginated, CourseSummaryDto } from "@skillstream/shared";

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
      {/* Mobile gets this control folded into the sticky Filters/Sort toolbar
          instead (see CatalogClient) so it isn't duplicated on small screens. */}
      <div className="mb-4 hidden items-center justify-between lg:sticky lg:top-16 lg:z-10 lg:-mt-4 lg:flex lg:bg-[linear-gradient(135deg,#f1f4f8,#f3e3f4)] lg:py-4 dark:lg:bg-background dark:lg:bg-none">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" /> Sort
        </span>
        <SortSelect value={sort} onChange={onSortChange} />
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
