"use client";

import { useState } from "react";
import Link from "next/link";
import { courses } from "@/lib/mock/courses";
import { getInstructor } from "@/lib/mock/instructors";
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
import { Plus, Search, MoreHorizontal, Pencil, Eye, Copy, Trash2 } from "lucide-react";
import type { CourseStatus } from "@/types";

const statusStyle: Record<CourseStatus, string> = {
  published: "text-success",
  draft: "text-muted-foreground",
  review: "text-warning-foreground",
};

export default function AdminCourses() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | CourseStatus>("all");

  const filtered = courses.filter((c) => {
    if (q && !c.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (status !== "all" && c.status !== status) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
          <p className="text-muted-foreground">{courses.length} courses · {courses.filter((c) => c.status === "published").length} published</p>
        </div>
        <Button render={<Link href="/admin/courses/new" />}><Plus /> New course</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses…" className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(["all", "published", "draft", "review"] as const).map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)} className="capitalize">
              {s}
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
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <CourseArt seed={c.thumbnail} title={c.title} className="h-10 w-16 shrink-0 rounded-md" iconSize={16} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{c.title}</div>
                        <div className="text-xs text-muted-foreground">{getInstructor(c.instructorId)?.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${statusStyle[c.status]}`}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>{compactNumber(c.studentCount)}</TableCell>
                  <TableCell>{c.rating > 0 ? <Stars rating={c.rating} size={12} showValue /> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{formatUsd(c.basePrice)}</TableCell>
                  <TableCell className="font-medium">{formatUsd(c.revenue).replace(".00", "")}</TableCell>
                  <TableCell className="pr-6 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem render={<Link href={`/admin/courses/${c.id}/edit`} />}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem render={<Link href={`/courses/${c.slug}`} />}><Eye /> View</DropdownMenuItem>
                        <DropdownMenuItem><Copy /> Duplicate</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive"><Trash2 /> Delete</DropdownMenuItem>
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
