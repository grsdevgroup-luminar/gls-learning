"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminMembershipEntryDto } from "@skillstream/shared";
import { adminApi, type AdminStudentProfileDto } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { ProfileDetails, ProfileSkeleton } from "@/components/shared/student-profile-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2, Handshake, History, RotateCcw, UserCircle,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Platform-admin-only wrapper around the shared StudentProfileDialog content
 * — adds "Memberships" (current + past org/partner-course memberships, with
 * a restore action for anything an org/partner removed) and "Activity"
 * (audited invite/remove/restore events) tabs that only a platform admin
 * should see. StudentProfileDialog itself stays untouched so the org-admin's
 * own member view keeps its narrower, read-only presentation.
 */
export function AdminStudentDetailDialog({
  studentId,
  open,
  onOpenChange,
}: {
  studentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();

  const { data: student, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ["admin", "student-profile", studentId],
    queryFn: () => adminApi.studentProfile(studentId!),
    enabled: Boolean(studentId) && open,
  });
  const { data: memberships, isLoading: membershipsLoading } = useQuery({
    queryKey: ["admin", "student-memberships", studentId],
    queryFn: () => adminApi.studentMemberships(studentId!),
    enabled: Boolean(studentId) && open,
  });
  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["admin", "student-activity", studentId],
    queryFn: () => adminApi.studentActivity(studentId!),
    enabled: Boolean(studentId) && open,
  });

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "student-memberships", studentId] });
    void qc.invalidateQueries({ queryKey: ["admin", "student-activity", studentId] });
    void qc.invalidateQueries({ queryKey: ["admin", "students"] });
  };

  const restoreOrgMutation = useMutation({
    mutationFn: (orgId: string) => adminApi.restoreOrgMembership(studentId!, orgId),
    onSuccess: () => { toast.success("Membership restored"); invalidateAll(); },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const restorePartnerMutation = useMutation({
    mutationFn: (courseAssignmentId: string) =>
      adminApi.restorePartnerMembership(studentId!, courseAssignmentId),
    onSuccess: () => { toast.success("Access restored"); invalidateAll(); },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(800px,calc(100vh-2rem))] w-[calc(100vw-2rem)] !max-w-none flex-col overflow-visible sm:w-[min(760px,calc(100vw-3rem))] sm:min-w-[680px]">
        <DialogHeader>
          <DialogTitle>Student detail</DialogTitle>
          <DialogDescription>
            Profile, org/delivery-partner membership history, and activity — platform-admin view.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="shrink-0">
            <TabsTrigger value="overview"><UserCircle className="h-3.5 w-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="memberships"><Building2 className="h-3.5 w-3.5" /> Memberships</TabsTrigger>
            <TabsTrigger value="activity"><History className="h-3.5 w-3.5" /> Activity</TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-auto pr-1 pt-4">
            <TabsContent value="overview">
              {profileLoading ? <ProfileSkeleton /> : profileError ? (
                <p className="py-8 text-sm text-destructive">Failed to load this student's profile.</p>
              ) : student ? <ProfileDetails student={student as AdminStudentProfileDto} /> : null}
            </TabsContent>

            <TabsContent value="memberships" className="space-y-6">
              {membershipsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
                </div>
              ) : (
                <>
                  <MembershipSection
                    title="Organizations"
                    icon={Building2}
                    entries={memberships?.organizations ?? []}
                    onRestore={(id) => restoreOrgMutation.mutate(id)}
                    restoring={restoreOrgMutation.isPending ? restoreOrgMutation.variables : undefined}
                    label={(e) => e.orgName ?? "Organization"}
                    sublabel={(e) => e.role ?? undefined}
                  />
                  <MembershipSection
                    title="Delivery-partner courses"
                    icon={Handshake}
                    entries={memberships?.deliveryPartnerCourses ?? []}
                    onRestore={(id) => restorePartnerMutation.mutate(id)}
                    restoring={restorePartnerMutation.isPending ? restorePartnerMutation.variables : undefined}
                    label={(e) => e.courseTitle ?? "Course"}
                    sublabel={(e) => e.partnerName ?? undefined}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="activity">
              {activityLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                </div>
              ) : !activity || activity.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No recorded activity for this student yet.</p>
              ) : (
                <ol className="space-y-3">
                  {activity.map((event) => (
                    <li key={event.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{formatAction(event.action)}</div>
                        <div className="text-xs text-muted-foreground">
                          {event.actor ? `By ${event.actor.name} · ` : ""}
                          {new Date(event.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function MembershipSection({
  title,
  icon: Icon,
  entries,
  onRestore,
  restoring,
  label,
  sublabel,
}: {
  title: string;
  icon: typeof Building2;
  entries: AdminMembershipEntryDto[];
  onRestore: (id: string) => void;
  restoring: string | undefined;
  label: (e: AdminMembershipEntryDto) => string;
  sublabel: (e: AdminMembershipEntryDto) => string | undefined;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h3>
      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No {title.toLowerCase()} history.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={`${e.id}-${e.joinedAt}`} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{label(e)}</span>
                  {sublabel(e) && <span className="text-xs text-muted-foreground">{sublabel(e)}</span>}
                  {e.removedAt ? (
                    <Badge variant="outline" className="text-destructive">Removed</Badge>
                  ) : (
                    <Badge variant="outline" className="text-success">Active</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Joined {new Date(e.joinedAt).toLocaleDateString()}
                  {e.removedAt && (
                    <>
                      {" "}· Removed {new Date(e.removedAt).toLocaleDateString()}
                      {e.removedBy ? ` by ${e.removedBy.name}` : ""}
                      {e.removedReason ? ` — "${e.removedReason}"` : " (no reason given)"}
                    </>
                  )}
                </p>
              </div>
              {e.removedAt && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 text-xs"
                  disabled={restoring === e.id}
                  onClick={() => onRestore(e.id)}
                >
                  <RotateCcw className="h-3 w-3" /> Restore
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatAction(action: string): string {
  // "ORG_MEMBER_REMOVED" -> "Org member removed"
  const lower = action.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
