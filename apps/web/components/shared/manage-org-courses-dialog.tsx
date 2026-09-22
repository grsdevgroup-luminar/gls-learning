"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MAX_PAGE_SIZE } from "@skillstream/shared";
import { adminApi, orgApi, type InstructorCourseDto } from "@/lib/api/endpoints";
import { useCategories } from "@/lib/api/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import { CourseArt } from "@/components/shared/course-art";
import { CourseVisibilityIcon } from "@/components/shared/course-visibility-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AdminPagination } from "@/app/admin/_components/admin-pagination";
import { BulkAssignConfirmDialog } from "@/components/shared/bulk-assign-confirm-dialog";
import { BookOpenCheck, Plus, Search, X, BookOpen, Layers } from "lucide-react";
import { toast } from "sonner";

const ALL_CATEGORIES = "ALL";
const PAGE_SIZE = 8;

/** Fetches every course matching the filter across all pages — the picker
 *  itself only ever loads one page at a time, but a bulk assign needs the
 *  full matching set. */
async function fetchAllMatching(params: {
  q?: string;
  category?: string;
  unassignedToOrgId: string;
}): Promise<InstructorCourseDto[]> {
  const all: InstructorCourseDto[] = [];
  let page = 1;
  for (;;) {
    const res = await adminApi.courses({ ...params, status: "PUBLISHED", page, pageSize: MAX_PAGE_SIZE });
    all.push(...res.items);
    if (page >= res.totalPages) break;
    page++;
  }
  return all;
}

/**
 * Platform-admin-only: which courses a company gets is a SkillStream
 * decision (OrganizationsService.assertPlatformAdmin rejects an org's own
 * admin), so this is the one place assignment happens — the org portal's own
 * Courses page is read-only. Lists what's assigned (with remove) and lets the
 * admin search/filter/page through every other published course (public or
 * private — assignment has no visibility precondition) to add more.
 *
 * The dialog is a fixed-height flex column (`h-[min(...)]`, not `max-h-`) so
 * assigning/removing a course never resizes the modal — the body scrolls
 * inside that fixed frame instead. Below the `lg` breakpoint the two sections
 * stack in one shared scroll region (there's not enough width for a second
 * column); at `lg`+ they sit side by side, each scrolling independently, so
 * browsing/paginating "Add courses" never pushes "Assigned" out of view or
 * vice versa.
 */
export function ManageOrgCoursesDialog({ orgId, orgName }: { orgId: string; orgName: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [qInput, setQInput] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [page, setPage] = useState(1);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const q = useDebouncedSearch(qInput);

  useEffect(() => {
    setPage(1);
  }, [q, category]);

  const { data: assignedCourses, isLoading: assignedLoading } = useQuery({
    queryKey: ["org", orgId, "courses"],
    queryFn: () => orgApi.courses(orgId),
    enabled: open,
  });
  const { data: categories = [] } = useCategories();
  const { data: coursePage, isLoading: catalogLoading } = useQuery({
    queryKey: [
      "admin",
      "courses",
      "assignable",
      orgId,
      { q, category, page },
    ],
    queryFn: () =>
      adminApi.courses({
        status: "PUBLISHED",
        unassignedToOrgId: orgId,
        q: q || undefined,
        category: category === ALL_CATEGORIES ? undefined : category,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: open,
    placeholderData: (prev) => prev,
  });

  // If the result set shrinks out from under the current page (e.g. the last
  // item on the last page just got assigned, or a search/filter narrows the
  // match count) the server returns an empty `items` for an out-of-range
  // page rather than clamping it — snap back to the actual last page so the
  // list never silently goes blank.
  useEffect(() => {
    if (coursePage && page > coursePage.totalPages && coursePage.totalPages >= 1) {
      setPage(coursePage.totalPages);
    }
  }, [coursePage, page]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["org", orgId, "courses"] });
    void qc.invalidateQueries({ queryKey: ["admin-organizations"] });
    // Covers both this dialog's own "assignable" list (a course should drop
    // out of it the moment it's assigned) and the admin courses table's Orgs
    // count column. Assignment never touches visibility, so the public
    // catalog is never affected and doesn't need invalidating here.
    void qc.invalidateQueries({ queryKey: ["admin", "courses"] });
  };

  const assignMutation = useMutation({
    mutationFn: (courseId: string) => orgApi.assignCourse(orgId, courseId),
    onSuccess: () => { toast.success("Course assigned"); invalidate(); },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const unassignMutation = useMutation({
    mutationFn: (courseId: string) => orgApi.unassignCourse(orgId, courseId),
    onSuccess: () => { toast.success("Course removed"); invalidate(); },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const bulkAssignFilter = {
    q: q || undefined,
    category: category === ALL_CATEGORIES ? undefined : category,
    unassignedToOrgId: orgId,
  };
  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      const matches = await fetchAllMatching(bulkAssignFilter);
      const results = await Promise.allSettled(
        matches.map((c) => orgApi.assignCourse(orgId, c.id)),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      return { succeeded, failed: results.length - succeeded };
    },
    onSuccess: ({ succeeded, failed }) => {
      if (succeeded === 0 && failed === 0) toast.info("No matching courses to assign");
      else if (failed === 0) toast.success(`Assigned ${succeeded} course${succeeded === 1 ? "" : "s"}`);
      else toast.warning(`Assigned ${succeeded} course${succeeded === 1 ? "" : "s"} — ${failed} failed`);
      invalidate();
      setPage(1);
      setBulkConfirmOpen(false);
    },
    onError: (err) => { toast.error(getApiErrorMessage(err)); setBulkConfirmOpen(false); },
  });

  const bulkAssignLabel =
    category !== ALL_CATEGORIES
      ? `all courses in "${category}"`
      : q
        ? "all matching courses"
        : "all published courses";

  const assigned = assignedCourses ?? [];
  const assignedIds = new Set(assigned.map((c) => c.id));
  // The query already excludes courses assigned to this org (unassignedToOrgId) —
  // this filter is just a defensive guard against the brief window before a
  // just-assigned course's cache invalidation lands.
  const available = (coursePage?.items ?? []).filter((c) => !assignedIds.has(c.id));

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) { setQInput(""); setCategory(ALL_CATEGORIES); setPage(1); }
        }}
      >
        <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" />}>
          <BookOpenCheck className="h-3 w-3" /> Courses
        </DialogTrigger>
        <DialogContent className="flex h-[min(760px,calc(100vh-2rem))] w-[calc(100vw-2rem)] !max-w-none flex-col sm:w-[min(640px,calc(100vw-3rem))] sm:min-w-[560px] lg:w-[min(960px,calc(100vw-4rem))] lg:min-w-[880px]">
          <DialogHeader>
            <DialogTitle>{orgName} — courses</DialogTitle>
            <DialogDescription>
              Assign or remove the courses available to this organization&apos;s members — public
              courses are curated into their list, private courses are only reachable this way.
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-1 min-h-0 flex-1 overflow-auto px-1 lg:overflow-hidden">
            <div className="space-y-5 lg:grid lg:h-full lg:grid-cols-2 lg:gap-6 lg:space-y-0">
              <section className="lg:flex lg:min-h-0 lg:flex-col">
                <p className="mb-2 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Assigned ({assigned.length})
                </p>
                <div className="space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
                  {assignedLoading ? (
                    Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)
                  ) : assigned.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No courses assigned yet.</p>
                  ) : (
                    assigned.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 rounded-lg border p-2">
                        <CourseArt seed={c.thumbnail} title={c.title} className="h-8 w-8 shrink-0 rounded-md" />
                        <div className="min-w-0 flex-1 truncate text-sm" title={c.title}>{c.title}</div>
                        <CourseVisibilityIcon visibility={c.visibility} />
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Remove course"
                          onClick={() => unassignMutation.mutate(c.id)}
                          disabled={unassignMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="border-t pt-4 lg:flex lg:min-h-0 lg:flex-col lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
                <div className="shrink-0">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Add courses
                  </p>
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={qInput}
                        onChange={(e) => setQInput(e.target.value)}
                        placeholder="Search courses…"
                        className="search-input h-8 border-input bg-background pl-8 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30"
                      />
                    </div>
                    <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                      <SelectTrigger className="h-8 w-full sm:w-44"><SelectValue /></SelectTrigger>
                      {/* alignItemWithTrigger (the default) lines the *selected* item up
                          with the trigger, native-<select>-style — which can slide the
                          whole list upward past the trigger once a non-first item is
                          selected. A plain "always opens below" combobox reads better
                          for a filter control, so opt out of that here. */}
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
                        {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {!!coursePage?.total && (
                    <button
                      type="button"
                      className="mb-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      onClick={() => setBulkConfirmOpen(true)}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      Assign {bulkAssignLabel} ({coursePage.total})
                    </button>
                  )}
                </div>

                <div className="space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
                  {catalogLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)
                  ) : available.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
                      <BookOpen className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {q || category !== ALL_CATEGORIES
                          ? "No courses match this search/filter."
                          : "All published courses are already assigned."}
                      </p>
                    </div>
                  ) : (
                    available.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 rounded-lg border p-2">
                        <CourseArt seed={c.thumbnail} title={c.title} className="h-8 w-8 shrink-0 rounded-md" />
                        <div className="min-w-0 flex-1" title={`${c.title} — ${c.category} · ${c.level}`}>
                          <div className="truncate text-sm">{c.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{c.category} · {c.level}</div>
                        </div>
                        <CourseVisibilityIcon visibility={c.visibility} />
                        <Button
                          size="icon-sm"
                          variant="outline"
                          aria-label="Add course"
                          onClick={() => assignMutation.mutate(c.id)}
                          disabled={assignMutation.isPending}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                {coursePage && coursePage.totalPages > 1 && (
                  <div className="shrink-0 pt-2">
                    <AdminPagination page={page} totalPages={coursePage.totalPages} onPageChange={setPage} />
                  </div>
                )}
              </section>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BulkAssignConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        targetName={orgName}
        label={bulkAssignLabel}
        count={coursePage?.total ?? 0}
        pending={bulkAssignMutation.isPending}
        onConfirm={() => bulkAssignMutation.mutate()}
      />
    </>
  );
}
