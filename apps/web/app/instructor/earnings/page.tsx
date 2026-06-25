"use client";

import { useStore } from "@/lib/context/store";
import { ApprovalGate } from "@/components/instructor/approval-gate";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { AreaTrend } from "@/components/charts/charts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Meter } from "@/components/shared/meter";
import { formatUsd, compactNumber } from "@/lib/format";
import { DollarSign, Wallet, Users, TrendingUp } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
// Gentle upward weighting so the trend reads like a growing business.
const WEIGHTS = [0.1, 0.12, 0.15, 0.17, 0.21, 0.25];

export default function InstructorEarnings() {
  const { myCourses, mounted } = useStore();
  if (!mounted) return null;

  const published = myCourses.filter((c) => c.status === "published");
  const total = myCourses.reduce((s, c) => s + c.revenue, 0);
  const students = myCourses.reduce((s, c) => s + c.studentCount, 0);
  const series = MONTHS.map((month, i) => ({ month, revenue: Math.round(total * WEIGHTS[i]) }));
  const thisMonth = series[series.length - 1].revenue;
  const pendingPayout = Math.round(thisMonth * 0.6);
  const topRevenue = Math.max(1, ...published.map((c) => c.revenue));

  return (
    <ApprovalGate>
      <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
        <header>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Earnings</h1>
          <p className="text-sm text-muted-foreground">Revenue is paid out monthly via your connected account.</p>
        </header>

        <StatStrip className="grid-cols-2 lg:grid-cols-4">
          <Stat icon={DollarSign} label="Lifetime earnings" value={formatUsd(total).replace(".00", "")} tint="var(--tint-emerald)" />
          <Stat icon={TrendingUp} label="This month" value={formatUsd(thisMonth).replace(".00", "")} tint="var(--tint-indigo)" />
          <Stat icon={Wallet} label="Pending payout" value={formatUsd(pendingPayout).replace(".00", "")} tint="var(--tint-amber)" />
          <Stat icon={Users} label="Paid students" value={compactNumber(students)} tint="var(--tint-sky)" />
        </StatStrip>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="text-base">Revenue trend</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <AreaTrend data={series} xKey="month" yKey="revenue" prefix="$" height={260} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Earnings by course</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {published.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published courses yet.</p>
            ) : (
              published
                .slice()
                .sort((a, b) => b.revenue - a.revenue)
                .map((c) => (
                  <div key={c.id} className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium">{c.title}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatUsd(c.revenue).replace(".00", "")}</span>
                      </div>
                      <Meter value={Math.round((c.revenue / topRevenue) * 100)} className="mt-1.5" />
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>
    </ApprovalGate>
  );
}
