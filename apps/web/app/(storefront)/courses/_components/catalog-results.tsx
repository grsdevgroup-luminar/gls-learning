"use client";

import { CourseCard } from "../../_components/course-card";
import { Button } from "@/components/ui/button";
import { SortSelect } from "./sort-select";
import { CourseGridSkeleton } from "@/components/shared/loading-skeletons";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
      <div className="mb-4 hidden justify-end lg:flex">
        <SortSelect value={sort} onChange={onSortChange} />
      </div>

      {isLoading ? (
        <CourseGridSkeleton />
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
