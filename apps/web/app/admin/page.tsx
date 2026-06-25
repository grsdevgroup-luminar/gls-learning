import {
  kpis, revenueSeries, enrollmentFunnel, revenueByRegion, topCourses, recentActivity,
} from "@/lib/mock/analytics";
import { AreaTrend, BarTrend, Donut } from "@/components/charts/charts";
import { Stars } from "@/components/shared/stars";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatUsd, compactNumber } from "@/lib/format";
import {
  DollarSign, Users, GraduationCap, Target, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

const kpiCards = [
  { icon: DollarSign, label: "Revenue (YTD)", value: formatUsd(kpis.revenue).replace(".00", ""), delta: kpis.revenueDelta, tint: "var(--tint-emerald)" },
  { icon: GraduationCap, label: "Enrollments", value: compactNumber(kpis.enrollments), delta: kpis.enrollmentsDelta, tint: "var(--tint-indigo)" },
  { icon: Users, label: "Active students", value: compactNumber(kpis.activeStudents), delta: kpis.activeStudentsDelta, tint: "var(--tint-sky)" },
  { icon: Target, label: "Completion rate", value: `${kpis.completionRate}%`, delta: kpis.completionRateDelta, tint: "var(--tint-violet)" },
];

export default function AdminOverview() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">How your course business is performing.</p>
      </div>

      {/* KPIs — embedded strip, not floating metric cards */}
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
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                  k.delta >= 0
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {k.delta >= 0 ? (
                  <ArrowUpRight className="mr-0.5 size-3" />
                ) : (
                  <ArrowDownRight className="mr-0.5 size-3" />
                )}
                {Math.abs(k.delta)}%
              </span>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{k.value}</div>
            <div className="mt-1.5 text-xs text-muted-foreground">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue + region */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue & enrollments</CardTitle>
            <CardDescription>Monthly revenue trend · MRR {formatUsd(kpis.mrr).replace(".00", "")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AreaTrend data={revenueSeries} xKey="month" yKey="revenue" prefix="$" height={260} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by region</CardTitle></CardHeader>
          <CardContent>
            <Donut data={revenueByRegion} nameKey="region" valueKey="value" prefix="$" height={200} />
            <div className="mt-3 space-y-1.5">
              {revenueByRegion.map((r, i) => (
                <div key={r.region} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--chart-${i + 1})` }} />
                    {r.region}
                  </span>
                  <span className="text-muted-foreground">{formatUsd(r.value).replace(".00", "")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel + activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Conversion funnel</CardTitle>
            <CardDescription>From course view to completion</CardDescription>
          </CardHeader>
          <CardContent>
            <BarTrend data={enrollmentFunnel} xKey="stage" yKey="value" horizontal height={260} color="var(--chart-1)" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <div>
                  <span className="font-medium">{a.who}</span>{" "}
                  <span className="text-muted-foreground">{a.action}</span>{" "}
                  <span className="font-medium">{a.target}</span>
                  <div className="text-xs text-muted-foreground">{a.when}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Top courses */}
      <Card>
        <CardHeader><CardTitle className="text-base">Top performing courses</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topCourses.map((c, i) => (
              <div key={c.title} className="flex items-center gap-4 rounded-lg p-2 hover:bg-muted/50">
                <span className="w-5 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{c.title}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Stars rating={c.rating} size={11} showValue /> · {compactNumber(c.students)} students
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{formatUsd(c.revenue).replace(".00", "")}</div>
                  <div className="text-xs text-muted-foreground">revenue</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
