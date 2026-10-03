"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/endpoints";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { CollapsibleStats } from "@/components/shared/collapsible-stats";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { ApplicationsTab } from "./_components/applications-tab";
import { RosterTab } from "./_components/roster-tab";
import { NameChangeRequestsTab } from "./_components/name-change-requests-tab";
import { ExpertiseChangeRequestsTab } from "./_components/expertise-change-requests-tab";

export default function AdminInstructors() {
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["admin", "instructor-application-stats"],
    queryFn: () => adminApi.instructorApplicationStats(),
  });
  const { data: profileReviewNameChanges } = useQuery({
    queryKey: ["admin", "instructor-name-change-requests"],
    queryFn: () => adminApi.instructorNameChangeRequests({ status: "PENDING", page: 1, pageSize: 50 }),
  });
  const { data: profileReviewExpertiseChanges } = useQuery({
    queryKey: ["admin", "instructor-expertise-change-requests"],
    queryFn: () => adminApi.instructorExpertiseChangeRequests({ status: "PENDING", page: 1, pageSize: 50 }),
  });
  const profileReviewCount =
    (profileReviewNameChanges?.total ?? 0) +
    (profileReviewExpertiseChanges?.total ?? 0);

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
          <TabsTrigger value="profile-review">
            Profile review
            {!!profileReviewCount && (
              <Badge
                variant="outline"
                className="ml-1.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] text-warning border-warning/30 bg-warning/10"
              >
                {profileReviewCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="applications"
          className="flex min-h-0 flex-1 flex-col gap-4 pt-4"
        >
          <CollapsibleStats
            summary={
              stats
                ? `${stats.pending} pending · ${stats.approved} approved · ${stats.rejected} rejected`
                : "Loading stats…"
            }
          >
            <StatStrip className="grid-cols-1 shrink-0 sm:grid-cols-3">
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
          </CollapsibleStats>
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
          value="profile-review"
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto pt-4"
        >
          <div className="rounded-xl border bg-card p-4 md:p-6">
            <div className="mb-3">
              <h2 className="text-base font-semibold">Profile review</h2>
              <p className="text-sm text-muted-foreground">
                Review instructor name and primary expertise changes. Each request is reviewed independently.
              </p>
            </div>
            <div className="space-y-6">
              <section>
                <h3 className="mb-2 text-sm font-medium">Name changes</h3>
                <NameChangeRequestsTab onMutated={() => {
                  qc.invalidateQueries({ queryKey: ["admin", "instructor-name-change-requests"] });
                  qc.invalidateQueries({ queryKey: ["admin", "instructor-roster"] });
                }} />
              </section>
              <section>
                <h3 className="mb-2 text-sm font-medium">Primary expertise changes</h3>
                <ExpertiseChangeRequestsTab onMutated={() => {
                  qc.invalidateQueries({ queryKey: ["admin", "instructor-expertise-change-requests"] });
                  qc.invalidateQueries({ queryKey: ["instructor", "profile"] });
                  qc.invalidateQueries({ queryKey: ["admin", "instructor-roster"] });
                }} />
              </section>
            </div>
          </div>
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
