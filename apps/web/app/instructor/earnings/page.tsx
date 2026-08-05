"use client";

import { useQuery } from "@tanstack/react-query";
import { instructorApi } from "@/lib/api/endpoints";
import { ApprovalGate } from "../_components/approval-gate";
import { PayoutPanel } from "@/components/shared/payout-panel";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/shared/meter";
import { formatUsd, compactNumber } from "@/lib/format";
import { DollarSign, BookOpen, Users, Star } from "lucide-react";

export default function InstructorEarnings() {
  const { data: profile } = useQuery({
    queryKey: ["instructor", "profile"],
    queryFn: instructorApi.profile,
  });
  const { data: courses } = useQuery({
    queryKey: ["instructor", "courses"],
    queryFn: instructorApi.courses,
  });

  const published = (courses ?? []).filter((c) => c.status === "PUBLISHED");
  const totalUsd = (profile?.earningsCents ?? 0) / 100;
  const topRevenue = Math.max(1, ...published.map((c) => c.revenueCents));

  return (
    <ApprovalGate>
      <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
        <header>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Earnings</h1>
          <p className="text-sm text-muted-foreground">Request a payout of your available balance any time.</p>
        </header>

        <StatStrip className="grid-cols-2 lg:grid-cols-4">
          <Stat icon={DollarSign} label="Lifetime earnings" value={formatUsd(totalUsd).replace(".00", "")} tint="var(--tint-emerald)" />
          <Stat icon={BookOpen} label="Published courses" value={published.length} tint="var(--tint-indigo)" />
          <Stat icon={Users} label="Total students" value={compactNumber(profile?.studentCount ?? 0)} tint="var(--tint-sky)" />
          <Stat icon={Star} label="Avg. rating" value={profile?.ratingAvg ? profile.ratingAvg.toFixed(2) : "—"} tint="var(--tint-amber)" />
        </StatStrip>

        <PayoutPanel />

        <Card>
          <CardHeader><CardTitle className="text-base">Earnings by course</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {published.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published courses yet.</p>
            ) : (
              published
                .slice()
                .sort((a, b) => b.revenueCents - a.revenueCents)
                .map((c) => (
                  <div key={c.id} className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium">{c.title}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatUsd(c.revenueCents / 100).replace(".00", "")}
                        </span>
                      </div>
                      <Meter value={Math.round((c.revenueCents / topRevenue) * 100)} className="mt-1.5" />
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
