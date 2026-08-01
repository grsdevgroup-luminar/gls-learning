"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, authoringApi, type InstructorCourseDto } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { CourseArt } from "@/components/shared/course-art";
import { Stars } from "@/components/shared/stars";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Search, MoreHorizontal, Pencil, Eye, Trash2, Rocket } from "lucide-react";
import { toast } from "sonner";

type ApiStatus = "PUBLISHED" | "DRAFT" | "REVIEW";

const statusStyle: Record<ApiStatus, string> = {
  PUBLISHED: "text-success",
  DRAFT: "text-muted-foreground",
  REVIEW: "text-warning",
};

export default function AdminCourses() {
  const qc = useQueryClient();
  const { data: courses } = useQuery({
    queryKey: ["admin", "courses"],
    queryFn: adminApi.courses,
  });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | ApiStatus>("all");

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "courses"] });
    void qc.invalidateQueries({ queryKey: ["store", "courses"] });
  };

  const publishMutation = useMutation({
    mutationFn: (id: string) => authoringApi.setCourseStatus(id, "PUBLISHED"),
    onSuccess: (_, id) => {
      const c = (courses ?? []).find((x) => x.id === id);
      toast.success("Course approved & published 🚀", { description: c?.title });
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authoringApi.deleteCourse(id),
    onSuccess: (_, id) => {
      const c = (courses ?? []).find((x) => x.id === id);
      toast.success("Course deleted", { description: c?.title });
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const all = courses ?? [];
  const filtered = all.filter((c) => {
    if (q && !c.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (status !== "all" && c.status !== status) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
          <p className="text-muted-foreground">
            {all.length} courses · {all.filter((c) => c.status === "PUBLISHED").length} published
          </p>
        </div>
        <Button render={<Link href="/admin/courses/new" />}><Plus /> New course</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses…" className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(["all", "PUBLISHED", "DRAFT", "REVIEW"] as const).map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)} className="capitalize">
              {s.toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      <Card className="p-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Course</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead className="pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: InstructorCourseDto) => (
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
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(c.id)}><Trash2 /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
