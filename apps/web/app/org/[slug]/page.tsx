"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { orgApi } from "@/lib/api/endpoints";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CourseArt } from "@/components/shared/course-art";
import { Users, BookOpen, Layers, Mail } from "lucide-react";
import { initials } from "@/lib/format";

const statusColors: Record<string, string> = {
  ACTIVE: "text-success",
  TRIAL: "text-warning",
  SUSPENDED: "text-destructive",
};

export default function OrgOverview() {
  const params = useParams<{ slug: string }>();
  const { data: org } = useQuery({
    queryKey: ["org", params.slug],
    queryFn: () => orgApi.bySlug(params.slug),
    enabled: !!params.slug,
  });
  const { data: courses } = useQuery({
    queryKey: ["org", org?.id, "courses"],
    queryFn: () => orgApi.courses(org!.id),
    enabled: !!org?.id,
  });

  if (!org) return null;

  const assigned = courses ?? [];
  const statusLabel = org.status.charAt(0) + org.status.slice(1).toLowerCase();

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Company Admin</p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight">{org.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            {org.domain && (
              <span className="text-sm text-muted-foreground">{org.domain}</span>
            )}
            <Badge variant="outline" className={statusColors[org.status]}>
              {statusLabel}
            </Badge>
          </div>
        </div>
      </header>

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Members" value={`${org.usedSeats} / ${org.seatCount}`} tint="var(--tint-indigo)" />
        <Stat icon={BookOpen} label="Assigned courses" value={assigned.length} tint="var(--tint-sky)" />
        <Stat icon={Layers} label="Seats available" value={org.seatCount - org.usedSeats} tint="var(--tint-emerald)" />
        <Stat icon={Mail} label="Admin" value={org.adminEmail.split("@")[0]} tint="var(--tint-amber)" />
      </StatStrip>

      {/* Seat usage bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seat usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>{org.usedSeats} of {org.seatCount} seats used</span>
            <span className="text-muted-foreground">
              {org.seatCount - org.usedSeats} available
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (org.usedSeats / org.seatCount) * 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Assigned courses */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Assigned courses</h2>
          <Link href={`/org/${params.slug}/courses`} className="text-sm text-primary hover:underline">
            Manage →
          </Link>
        </div>
        {assigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">No courses assigned yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assigned.map((c) => (
              <Card key={c.id} className="flex gap-3 p-4">
                <CourseArt seed={c.thumbnail} title={c.title} className="h-12 w-12 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{c.level}</div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent members */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent members</h2>
          <Link href={`/org/${params.slug}/members`} className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </div>
        <Card>
          <CardContent className="divide-y p-0">
            {org.members.slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{initials(m.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                </div>
                <Badge variant="outline" className={m.role === "ADMIN" ? "text-primary" : "text-muted-foreground"}>
                  {m.role.toLowerCase()}
                </Badge>
              </div>
            ))}
            {org.members.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No members yet — send your first invite.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
