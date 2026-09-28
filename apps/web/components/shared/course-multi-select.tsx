"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/endpoints";
import { useCategories } from "@/lib/api/hooks";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import { CourseArt } from "@/components/shared/course-art";
import { CourseVisibilityIcon } from "@/components/shared/course-visibility-icon";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AdminPagination } from "@/app/admin/_components/admin-pagination";
import { BookOpen, Search } from "lucide-react";

const ALL_CATEGORIES = "ALL";
const PAGE_SIZE = 10;

/**
 * Searchable, paginated checkbox list against the entire published catalog —
 * deliberately not filtered by any partner/org assignment (unlike
 * ManagePartnerCoursesDialog's "Add courses" panel, which this generalizes):
 * a campaign's course scope is independent of which courses a partner is
 * assigned to distribute. Purely a controlled `selectedIds`/`onChange` list —
 * no assign/unassign mutation of its own.
 */
export function CourseMultiSelect({
  selectedIds,
  onChange,
  disabled,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [qInput, setQInput] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [page, setPage] = useState(1);
  const q = useDebouncedSearch(qInput);

  useEffect(() => {
    setPage(1);
  }, [q, category]);

  const { data: categories = [] } = useCategories();
  const { data: coursePage, isLoading } = useQuery({
    queryKey: ["admin", "courses", "campaign-scope", { q, category, page }],
    queryFn: () =>
      adminApi.courses({
        status: "PUBLISHED",
        q: q || undefined,
        category: category === ALL_CATEGORIES ? undefined : category,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (coursePage && page > coursePage.totalPages && coursePage.totalPages >= 1) {
      setPage(coursePage.totalPages);
    }
  }, [coursePage, page]);

  const selected = new Set(selectedIds);
  const toggle = (courseId: string) => {
    if (disabled) return;
    onChange(
      selected.has(courseId)
        ? selectedIds.filter((id) => id !== courseId)
        : [...selectedIds, courseId],
    );
  };

  const items = coursePage?.items ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search courses…"
            className="search-input h-8 border-input bg-background pl-8 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30"
            disabled={disabled}
          />
        </div>
        <Select value={category} onValueChange={(v) => v && setCategory(v)}>
          <SelectTrigger className="h-8 w-44 shrink-0" disabled={disabled}><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {selectedIds.length} course{selectedIds.length === 1 ? "" : "s"} selected
      </p>

      <div className="max-h-80 overflow-y-auto rounded-lg border p-1.5">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No courses match this search/filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {items.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md p-1.5 hover:bg-muted/50"
              >
                <Checkbox
                  checked={selected.has(c.id)}
                  onCheckedChange={() => toggle(c.id)}
                  disabled={disabled}
                />
                <CourseArt seed={c.thumbnail} title={c.title} className="h-9 w-9 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1" title={`${c.title} — ${c.category} · ${c.level}`}>
                  <div className="truncate text-sm">{c.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.category} · {c.level}</div>
                </div>
                <CourseVisibilityIcon visibility={c.visibility} />
              </label>
            ))}
          </div>
        )}
      </div>

      {coursePage && coursePage.totalPages > 1 && (
        <AdminPagination page={page} totalPages={coursePage.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
