"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/endpoints";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { ApplicationsTab } from "./_components/applications-tab";
import { RosterTab } from "./_components/roster-tab";

export default function AdminInstructors() {
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["admin", "instructor-application-stats"],
    queryFn: () => adminApi.instructorApplicationStats(),
  });

  return (
    <div className="flex h-screen flex-col space-y-6 p-6 md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Instructors</h1>
        <p className="text-muted-foreground">
          Review instructor applications and profile name changes while keeping
          approved instructors active.
        </p>
      </div>

      <Tabs
        defaultValue="applications"
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="shrink-0">
          <TabsTrigger value="applications">
            Applications
            {!!stats?.pending && (
              <Badge
                variant="outline"
                className="ml-1.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] text-warning border-warning/30 bg-warning/10"
              >
                {stats.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="roster">Active instructors</TabsTrigger>
        </TabsList>

        <TabsContent
          value="applications"
          className="flex min-h-0 flex-1 flex-col gap-4 pt-4"
        >
          <StatStrip className="grid-cols-2 shrink-0 lg:grid-cols-3">
            <Stat
              icon={Clock}
              label="Pending applications"
              value={stats?.pending ?? "—"}
              tint="var(--tint-amber)"
            />
            <Stat
              icon={CheckCircle2}
              label="Approved applications"
              value={stats?.approved ?? "—"}
              tint="var(--tint-emerald)"
            />
            <Stat
              icon={XCircle}
              label="Rejected"
              value={stats?.rejected ?? "—"}
              tint="var(--tint-rose)"
            />
          </StatStrip>
          <ApplicationsTab
            onMutated={() => {
              qc.invalidateQueries({
                queryKey: ["admin", "instructor-applications"],
              });
              qc.invalidateQueries({
                queryKey: ["admin", "instructor-application-stats"],
              });
              qc.invalidateQueries({
                queryKey: ["admin", "instructor-roster"],
              });
            }}
          />
        </TabsContent>

        <TabsContent
          value="roster"
          className="flex min-h-0 flex-1 flex-col gap-4 pt-4"
        >
          <RosterTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
