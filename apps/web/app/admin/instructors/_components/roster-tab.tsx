"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type InstructorProfileDto } from "@/lib/api/endpoints";
import { useCategories } from "@/lib/api/hooks";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { Stars } from "@/components/shared/stars";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, GraduationCap, Search } from "lucide-react";
import { initials, compactNumber, relativeDate } from "@/lib/format";
import {
  AdminPagination,
  AdminRowsPerPage,
  ADMIN_PAGE_SIZE_OPTIONS,
} from "../../_components/admin-pagination";
import {
  AdminTableCard,
  stickyHeaderCellClass,
  stickyHeaderRowClass,
} from "../../_components/admin-table";

export function RosterTab() {
  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [expertise, setExpertise] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);
  const { data: categories = [] } = useCategories();

  useEffect(() => setPage(1), [q, expertise, pageSize]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "instructor-roster", { q, expertise, page, pageSize }],
    queryFn: () =>
      adminApi.instructors({
        q: q || undefined,
        expertise: expertise === "all" ? undefined : expertise,
        page,
        pageSize,
      }),
  });

  const roster = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalStudents = roster.reduce((s, i) => s + i.studentCount, 0);

  useEffect(() => {
    if (data && page > data.totalPages) setPage(data.totalPages);
  }, [data, page]);

  return (
    <>
      <StatStrip className="grid-cols-1 shrink-0 sm:grid-cols-2">
        <Stat icon={GraduationCap} label="Active instructors" value={data?.total ?? "—"} tint="var(--tint-indigo)" />
        <Stat icon={Users} label="Students on this page" value={compactNumber(totalStudents)} tint="var(--tint-sky)" />
      </StatStrip>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search instructors…" className="search-input border-input bg-background pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30" />
        </div>
        <Select value={expertise} onValueChange={(v) => v && setExpertise(v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All expertise</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <AdminRowsPerPage value={pageSize} onChange={(v) => setPageSize(v)} />
        </div>
      </div>

      <AdminTableCard className="min-h-0 flex-1" scrollClassName="h-full max-h-none">
        <Table>
          <TableHeader>
            <TableRow className={stickyHeaderRowClass}>
              <TableHead className={`pl-6 ${stickyHeaderCellClass}`}>Instructor</TableHead>
              <TableHead className={stickyHeaderCellClass}>Headline</TableHead>
              <TableHead className={stickyHeaderCellClass}>Courses</TableHead>
              <TableHead className={stickyHeaderCellClass}>Students</TableHead>
              <TableHead className={stickyHeaderCellClass}>Rating</TableHead>
              <TableHead className={`pr-6 ${stickyHeaderCellClass}`}>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(6)].map((__, j) => (
                    <TableCell key={j} className={j === 0 ? "pl-6" : j === 5 ? "pr-6" : ""}>
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : roster.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No instructors found.</TableCell>
              </TableRow>
            ) : (
              roster.map((i: InstructorProfileDto) => (
                <TableRow key={i.userId}>
                  <TableCell className="pl-6">
                    <Link href={`/instructors/${i.userId}`} target="_blank" className="flex items-center gap-3 hover:underline">
                      <Avatar className="size-8 ring-1 ring-border">
                        <AvatarFallback className="brand-gradient text-xs text-white">{initials(i.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{i.name}</div>
                        <div className="text-xs text-muted-foreground">{i.email}</div>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-sm text-muted-foreground">{i.title || "—"}</TableCell>
                  <TableCell>{i.courseCount}</TableCell>
                  <TableCell>{compactNumber(i.studentCount)}</TableCell>
                  <TableCell>{i.ratingAvg > 0 ? <Stars rating={i.ratingAvg} size={12} showValue /> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="pr-6 text-sm text-muted-foreground">{i.joinedAt ? relativeDate(i.joinedAt) : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AdminTableCard>

      <div className="shrink-0 pt-2">
        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </>
  );
}
