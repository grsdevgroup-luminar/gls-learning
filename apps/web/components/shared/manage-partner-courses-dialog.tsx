"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MAX_PAGE_SIZE } from "@skillstream/shared";
import { adminApi, type InstructorCourseDto } from "@/lib/api/endpoints";
import { useCategories } from "@/lib/api/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import { CourseArt } from "@/components/shared/course-art";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AdminPagination } from "@/app/admin/_components/admin-pagination";
import { BulkAssignConfirmDialog } from "@/components/shared/bulk-assign-confirm-dialog";
import { BookOpenCheck, Plus, Search, X, BookOpen, Lock, Globe, Layers, Users } from "lucide-react";
import { toast } from "sonner";

const ALL_CATEGORIES = "ALL";
const PAGE_SIZE = 8;
const DEFAULT_MEMBER_CAP = 0;

/** Fetches every course matching the filter across all pages — the picker
 *  itself only ever loads one page at a time, but a bulk assign needs the
 *  full matching set. Mirrors ManageOrgCoursesDialog's identically-named
 *  helper, filtered by partner instead of org. */
async function fetchAllMatching(params: {
  q?: string;
  category?: string;
  unassignedToPartnerId: string;
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
 * Platform-admin-only, same reasoning as ManageOrgCoursesDialog: which
 * courses a delivery partner gets to redistribute is a platform decision.
 * The one structural difference from the org dialog — a delivery partner's
 * course assignment carries a member cap (decision #4/#5 in
 * DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §3), set when assigning and editable
 * afterward, mirroring how the Partners table already edits commission %
 * inline.
 */
export function ManagePartnerCoursesDialog({
  partnerId,
  partnerName,
}: {
  partnerId: string;
  partnerName: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [qInput, setQInput] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [page, setPage] = useState(1);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkMemberCap, setBulkMemberCap] = useState(DEFAULT_MEMBER_CAP);
  const [capInputs, setCapInputs] = useState<Record<string, string>>({});
  const [assignCapInputs, setAssignCapInputs] = useState<Record<string, string>>({});
  const q = useDebouncedSearch(qInput);

  useEffect(() => {
    setPage(1);
  }, [q, category]);

  const { data: assignedCourses, isLoading: assignedLoading } = useQuery({
    queryKey: ["admin", "delivery-partners", partnerId, "courses"],
    queryFn: () => adminApi.partnerCourses(partnerId),
    enabled: open,
  });
  const { data: categories = [] } = useCategories();
  const { data: coursePage, isLoading: catalogLoading } = useQuery({
    queryKey: [
      "admin",
      "courses",
      "assignable-partner",
      partnerId,
      { q, category, page },
    ],
    queryFn: () =>
      adminApi.courses({
        status: "PUBLISHED",
        unassignedToPartnerId: partnerId,
        q: q || undefined,
        category: category === ALL_CATEGORIES ? undefined : category,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: open,
    placeholderData: (prev) => prev,
  });

  // Same defensive re-clamp as ManageOrgCoursesDialog — a course leaving the
  // result set (just assigned, or a narrowed filter) can leave `page` past
  // the new last page.
  useEffect(() => {
    if (coursePage && page > coursePage.totalPages && coursePage.totalPages >= 1) {
      setPage(coursePage.totalPages);
    }
  }, [coursePage, page]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "delivery-partners", partnerId, "courses"] });
    void qc.invalidateQueries({ queryKey: ["admin", "delivery-partners"] });
    void qc.invalidateQueries({ queryKey: ["admin", "courses"] });
  };

  const assignMutation = useMutation({
    mutationFn: ({ courseId, memberCap }: { courseId: string; memberCap: number }) =>
      adminApi.assignPartnerCourse(partnerId, { courseId, memberCap }),
    onSuccess: (_data, { courseId }) => {
      toast.success("Course assigned");
      setAssignCapInputs((p) => { const n = { ...p }; delete n[courseId]; return n; });
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const unassignMutation = useMutation({
    mutationFn: (courseId: string) => adminApi.unassignPartnerCourse(partnerId, courseId),
    onSuccess: () => { toast.success("Course removed"); invalidate(); },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const updateCapMutation = useMutation({
    mutationFn: ({ courseId, memberCap }: { courseId: string; memberCap: number }) =>
      adminApi.updatePartnerCourseAssignment(partnerId, courseId, memberCap),
    onSuccess: (_data, { courseId }) => {
      toast.success("Member cap updated");
      setCapInputs((p) => { const n = { ...p }; delete n[courseId]; return n; });
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const bulkAssignFilter = {
    q: q || undefined,
    category: category === ALL_CATEGORIES ? undefined : category,
    unassignedToPartnerId: partnerId,
  };
  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      const matches = await fetchAllMatching(bulkAssignFilter);
      const results = await Promise.allSettled(
        matches.map((c) => adminApi.assignPartnerCourse(partnerId, { courseId: c.id, memberCap: bulkMemberCap })),
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
  const assignedIds = new Set(assigned.map((a) => a.course.id));
  // The query already excludes courses assigned to this partner
  // (unassignedToPartnerId) — this filter is just a defensive guard against
  // the brief window before a just-assigned course's cache invalidation lands.
  const available = (coursePage?.items ?? []).filter((c) => !assignedIds.has(c.id));

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) { setQInput(""); setCategory(ALL_CATEGORIES); setPage(1); setCapInputs({}); setAssignCapInputs({}); }
        }}
      >
        <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" />}>
          <BookOpenCheck className="h-3 w-3" /> Courses
        </DialogTrigger>
        <DialogContent className="flex h-[min(760px,calc(100vh-2rem))] w-[calc(100vw-2rem)] !max-w-none flex-col sm:w-[min(640px,calc(100vw-3rem))] sm:min-w-[560px] lg:w-[min(960px,calc(100vw-4rem))] lg:min-w-[880px]">
          <DialogHeader>
            <DialogTitle>{partnerName} — courses</DialogTitle>
            <DialogDescription>
              Assign or remove the courses this delivery partner can redistribute — each assignment sets how many
              members that partner can invite to it (0 = unlimited).
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
                    assigned.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 rounded-lg border p-2">
                        <CourseArt seed={a.course.thumbnail} title={a.course.title} className="h-8 w-8 shrink-0 rounded-md" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{a.course.title}</div>
                          <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {a.memberCap > 0 ? `${a.usedSeats} / ${a.memberCap} members` : `${a.usedSeats} members (unlimited)`}
                          </div>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={1000}
                          placeholder="0 = unlimited"
                          className="h-7 w-16 shrink-0 text-sm"
                          value={capInputs[a.course.id] ?? a.memberCap}
                          onChange={(e) => setCapInputs((p) => ({ ...p, [a.course.id]: e.target.value }))}
                        />
                        {capInputs[a.course.id] !== undefined && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 shrink-0 px-2 text-xs"
                            disabled={updateCapMutation.isPending}
                            onClick={() => updateCapMutation.mutate({ courseId: a.course.id, memberCap: Number(capInputs[a.course.id]) })}
                          >
                            Save
                          </Button>
                        )}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Remove course"
                          onClick={() => unassignMutation.mutate(a.course.id)}
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
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{c.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{c.category} · {c.level}</div>
                        </div>
                        {c.visibility === "PRIVATE" ? (
                          <Badge variant="outline" className="shrink-0 border-primary/30 text-primary">
                            <Lock data-icon="inline-start" /> Private
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="shrink-0 text-muted-foreground">
                            <Globe data-icon="inline-start" /> Public
                          </Badge>
                        )}
                        <Input
                          type="number"
                          min={0}
                          max={1000}
                          placeholder="0 = unlimited"
                          aria-label="Member cap"
                          className="h-8 w-20 shrink-0 text-sm"
                          value={assignCapInputs[c.id] ?? DEFAULT_MEMBER_CAP}
                          onChange={(e) => setAssignCapInputs((p) => ({ ...p, [c.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => assignMutation.mutate({
                            courseId: c.id,
                            memberCap: Number(assignCapInputs[c.id] ?? DEFAULT_MEMBER_CAP),
                          })}
                          disabled={assignMutation.isPending}
                        >
                          <Plus className="h-4 w-4" /> Add
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
        targetName={partnerName}
        label={bulkAssignLabel}
        count={coursePage?.total ?? 0}
        pending={bulkAssignMutation.isPending}
        onConfirm={() => bulkAssignMutation.mutate()}
        memberCap={bulkMemberCap}
        onMemberCapChange={setBulkMemberCap}
      />
    </>
  );
}
