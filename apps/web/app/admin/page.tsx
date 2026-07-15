"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/endpoints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd, compactNumber } from "@/lib/format";
import {
  DollarSign, Users, GraduationCap, Target, ArrowUpRight, BarChart2,
} from "lucide-react";

export default function AdminOverview() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: adminApi.overview,
  });

  if (error) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-destructive">Failed to load overview data.</p>
      </div>
    );
  }

  const kpiCards = data
    ? [
        {
          icon: DollarSign,
          label: "Revenue (YTD)",
          value: formatUsd(data.revenueCents / 100).replace(".00", ""),
          tint: "var(--tint-emerald)",
        },
        {
          icon: GraduationCap,
          label: "Enrollments",
          value: compactNumber(data.enrollments),
          tint: "var(--tint-indigo)",
        },
        {
          icon: Users,
          label: "Students",
          value: compactNumber(data.students),
          tint: "var(--tint-sky)",
        },
        {
          icon: Target,
          label: "Completion rate",
          value: `${data.completionRatePct}%`,
          tint: "var(--tint-violet)",
        },
      ]
    : [];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">How your course business is performing.</p>
      </div>

      {/* KPI strip */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card p-5">
              <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
              <div className="mt-3 h-7 w-24 animate-pulse rounded bg-muted" />
              <div className="mt-1.5 h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm lg:grid-cols-4">
          {kpiCards.map((k) => (
            <div
              key={k.label}
              className="group bg-card p-5"
              style={{ ["--tile" as string]: k.tint }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="icon-tile size-8">
                  <k.icon className="size-4" />
                </span>
                <span className="inline-flex items-center rounded-full bg-success/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-success">
                  <ArrowUpRight className="mr-0.5 size-3" />
                  live
                </span>
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{k.value}</div>
              <div className="mt-1.5 text-xs text-muted-foreground">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Secondary KPI row */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-5">
              <div className="text-2xl font-bold tabular-nums">{data.instructors}</div>
              <div className="text-xs text-muted-foreground">Instructors</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-2xl font-bold tabular-nums">{data.publishedCourses}</div>
              <div className="text-xs text-muted-foreground">Published courses</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-2xl font-bold tabular-nums">{data.paidOrders}</div>
              <div className="text-xs text-muted-foreground">Paid orders</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-2xl font-bold tabular-nums">{data.refundRatePct}%</div>
              <div className="text-xs text-muted-foreground">Refund rate</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts placeholder */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue &amp; enrollments</CardTitle>
          </CardHeader>
          <CardContent className="flex h-[260px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <BarChart2 className="size-8 opacity-30" />
            <p className="text-sm">Analytics charts coming soon</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by region</CardTitle></CardHeader>
          <CardContent className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <BarChart2 className="size-6 opacity-30" />
            <p className="text-sm">Analytics charts coming soon</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Conversion funnel</CardTitle>
          </CardHeader>
          <CardContent className="flex h-[260px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <BarChart2 className="size-8 opacity-30" />
            <p className="text-sm">Analytics charts coming soon</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
          <CardContent className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <p className="text-sm">Analytics charts coming soon</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
