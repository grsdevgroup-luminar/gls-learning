"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, authoringApi, type InstructorCourseDto } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { CourseArt } from "@/components/shared/course-art";
import { Stars } from "@/components/shared/stars";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatUsd, compactNumber } from "@/lib/format";
import {
  Plus, Search, MoreHorizontal, Pencil, Eye, Trash2, Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import {
  AdminPagination,
  AdminRowsPerPage,
  ADMIN_PAGE_SIZE_OPTIONS,
} from "../_components/admin-pagination";
import {
  AdminTableCard,
  stickyHeaderCellClass,
  stickyHeaderRowClass,
} from "../_components/admin-table";

type ApiStatus = "PUBLISHED" | "DRAFT" | "REVIEW";

const statusStyle: Record<ApiStatus, string> = {
  PUBLISHED: "text-success",
  DRAFT: "text-muted-foreground",
  REVIEW: "text-warning",
};

export default function AdminCourses() {
  const qc = useQueryClient();
  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [status, setStatus] = useState<"all" | ApiStatus>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);
  const [deleteTarget, setDeleteTarget] = useState<InstructorCourseDto | null>(null);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const { data: coursePage, isLoading } = useQuery({
    queryKey: ["admin", "courses", "list", { q, status, page, pageSize }],
    queryFn: () =>
      adminApi.courses({
        q: q || undefined,
        status: status === "all" ? undefined : status,
        page,
        pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin", "courses", "stats"],
    queryFn: adminApi.courseStats,
  });

  const courses = coursePage?.items ?? [];
  const totalPages = coursePage?.totalPages ?? 1;

  useEffect(() => {
    if (coursePage && page > coursePage.totalPages) setPage(coursePage.totalPages);
  }, [coursePage, page]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "courses"] });
    void qc.invalidateQueries({ queryKey: ["store", "courses"] });
  };

  const publishMutation = useMutation({
    mutationFn: (id: string) => authoringApi.setCourseStatus(id, "PUBLISHED"),
    onSuccess: (_, id) => {
      const c = courses?.find((x) => x.id === id);
      toast.success("Course approved & published 🚀", { description: c?.title });
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authoringApi.deleteCourse(id),
    onSuccess: (_, id) => {
      const c = courses?.find((x) => x.id === id);
      toast.success("Course deleted", { description: c?.title });
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <div className="flex h-screen flex-col space-y-6 p-6 md:p-8">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
          <p className="text-muted-foreground">
            {stats ? `${stats.total} courses · ${stats.published} published` : "…"}
          </p>
        </div>
        <Button render={<Link href="/admin/courses/new" />}><Plus /> New course</Button>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search courses…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "PUBLISHED", "DRAFT", "REVIEW"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className="capitalize"
            >
              {s.toLowerCase()}
            </Button>
          ))}
        </div>
        <div className="ml-auto">
          <AdminRowsPerPage
            value={pageSize}
            onChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <AdminTableCard>
          <Table>
            <TableHeader>
              <TableRow className={stickyHeaderRowClass}>
                <TableHead className={`pl-6 ${stickyHeaderCellClass}`}>Course</TableHead>
                <TableHead className={stickyHeaderCellClass}>Status</TableHead>
                <TableHead className={stickyHeaderCellClass}>Students</TableHead>
                <TableHead className={stickyHeaderCellClass}>Rating</TableHead>
                <TableHead className={stickyHeaderCellClass}>Price</TableHead>
                <TableHead className={stickyHeaderCellClass}>Revenue</TableHead>
                <TableHead className={`pr-6 ${stickyHeaderCellClass}`}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses?.map((c: InstructorCourseDto) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <CourseArt seed={c.thumbnail} title={c.title} className="h-10 w-16 shrink-0 rounded-md" iconSize={16} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{c.title}</div>
                        <div className="text-xs text-muted-foreground">{c.instructor.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${statusStyle[c.status as ApiStatus] ?? ""}`}>
                      {c.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{compactNumber(c.studentCount)}</TableCell>
                  <TableCell>{c.ratingAvg > 0 ? <Stars rating={c.ratingAvg} size={12} showValue /> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{formatUsd(c.basePriceCents / 100)}</TableCell>
                  <TableCell className="font-medium">{formatUsd(c.revenueCents / 100).replace(".00", "")}</TableCell>
                  <TableCell className="pr-6 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {c.status === "REVIEW" && (
                          <DropdownMenuItem
                            className="text-success"
                            onClick={() => publishMutation.mutate(c.id)}
                          >
                            <Rocket /> Approve &amp; publish
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem render={<Link href={`/admin/courses/${c.id}/edit`} />}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem render={<Link href={`/courses/${c.slug}`} />}><Eye /> View</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </AdminTableCard>

      {!isLoading && (
        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`Delete course "${deleteTarget?.title}"?`}
        description="This cannot be undone."
        pending={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMutation.mutateAsync(deleteTarget.id);
        }}
      />
    </div>
  );
}
