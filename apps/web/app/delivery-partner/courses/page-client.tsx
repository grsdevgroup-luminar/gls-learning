"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { partnerApi } from "@/lib/api/endpoints";
import { useMyDeliveryPartner } from "@/lib/api/delivery-partner-hooks";
import { PartnerMissingState, PartnerPageLoading, PartnerStatusState } from "../_components/partner-page-state";
import { CourseArt } from "@/components/shared/course-art";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Lock, Globe, BookOpen } from "lucide-react";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import {
  AdminPagination,
  AdminRowsPerPage,
  ADMIN_PAGE_SIZE_OPTIONS,
} from "@/app/admin/_components/admin-pagination";
import {
  AdminTableCard,
  stickyHeaderCellClass,
  stickyHeaderRowClass,
} from "@/app/admin/_components/admin-table";
import { ManageMembersDialog } from "./_components/manage-members-dialog";

const ALL_CATEGORIES = "ALL";
type SortKey = "title" | "seats" | "recent";

export default function PartnerCoursesPage() {
  const { data: partner, isLoading: partnerLoading } = useMyDeliveryPartner();
  const { data: assignments, isLoading: coursesLoading } = useQuery({
    queryKey: ["me", "delivery-partner", "courses"],
    queryFn: partnerApi.courses,
  });

  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);

  const all = assignments ?? [];
  const categories = useMemo(
    () => [...new Set(all.map((a) => a.course.category))].sort(),
    [all],
  );

  const filtered = useMemo(() => {
    let rows = all;
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((a) => a.course.title.toLowerCase().includes(needle));
    }
    if (category !== ALL_CATEGORIES) {
      rows = rows.filter((a) => a.course.category === category);
    }
    const sorted = [...rows];
    if (sort === "title") sorted.sort((a, b) => a.course.title.localeCompare(b.course.title));
    else if (sort === "seats") sorted.sort((a, b) => b.usedSeats / b.memberCap - a.usedSeats / a.memberCap);
    else sorted.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return sorted;
  }, [all, q, category, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [q, category, sort, pageSize]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (partnerLoading || coursesLoading) return <PartnerPageLoading />;
  if (!partner) return <PartnerMissingState />;
  if (partner.status !== "APPROVED") return <PartnerStatusState status={partner.status} />;

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
        <p className="text-muted-foreground">
          Courses you're approved to redistribute — invite members to give them free access.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search courses…" className="search-input border-input bg-background pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30" />
        </div>
        <Select value={category} onValueChange={(v) => v && setCategory(v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => v && setSort(v as SortKey)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="recent">Recently assigned</SelectItem>
            <SelectItem value="title">Title (A–Z)</SelectItem>
            <SelectItem value="seats">Most seats used</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <AdminRowsPerPage value={pageSize} onChange={setPageSize} />
        </div>
      </div>

      <AdminTableCard>
        <Table>
          <TableHeader>
            <TableRow className={stickyHeaderRowClass}>
              <TableHead className={stickyHeaderCellClass}>Course</TableHead>
              <TableHead className={stickyHeaderCellClass}>Visibility</TableHead>
              <TableHead className={stickyHeaderCellClass}>Members</TableHead>
              <TableHead className={`text-right ${stickyHeaderCellClass}`}>Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                  {all.length === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <BookOpen className="h-6 w-6" />
                      No courses assigned yet — an admin assigns courses for you to redistribute.
                    </div>
                  ) : (
                    "No courses match this search/filter."
                  )}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CourseArt seed={a.course.thumbnail} title={a.course.title} className="h-10 w-10 shrink-0 rounded-lg" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{a.course.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{a.course.category} · {a.course.level}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {a.course.visibility === "PRIVATE" ? (
                      <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                        <Lock className="h-3 w-3" /> Private
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <Globe className="h-3 w-3" /> Public
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{a.usedSeats} / {a.memberCap}</TableCell>
                  <TableCell className="text-right">
                    <ManageMembersDialog assignment={a} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AdminTableCard>

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
