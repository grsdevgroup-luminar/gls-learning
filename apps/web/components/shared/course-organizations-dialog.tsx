"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminCourseOrganizationDto, OrganizationDto } from "@skillstream/shared";
import { adminApi, orgApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, CalendarDays, Mail, Unlink, Users, Plus } from "lucide-react";
import { toast } from "sonner";

export function CourseOrganizationsDialog({ courseId, courseTitle, assignmentCount }: { courseId: string; courseTitle: string; assignmentCount: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AdminCourseOrganizationDto | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ["admin", "course-organizations", courseId],
    queryFn: () => adminApi.courseOrganizations(courseId),
    enabled: open,
  });
  const { data: allOrganizations = [], isLoading: organizationsLoading } = useQuery<OrganizationDto[]>({
    queryKey: ["admin-organizations"],
    queryFn: orgApi.list,
    enabled: open,
  });
  const assignedIds = new Set(organizations.map((organization) => organization.id));
  const availableOrganizations = allOrganizations.filter((organization) => !assignedIds.has(organization.id));
  const assignMutation = useMutation({
    mutationFn: (orgId: string) => orgApi.assignCourse(orgId, courseId),
    onSuccess: () => {
      toast.success("Course assigned");
      setSelectedOrgId("");
      void qc.invalidateQueries({ queryKey: ["admin", "course-organizations", courseId] });
      void qc.invalidateQueries({ queryKey: ["admin", "courses"] });
      void qc.invalidateQueries({ queryKey: ["admin-organizations"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const removeMutation = useMutation({
    mutationFn: (orgId: string) => orgApi.unassignCourse(orgId, courseId),
    onSuccess: () => {
      toast.success("Course unassigned");
      setRemoveTarget(null);
      void qc.invalidateQueries({ queryKey: ["admin", "course-organizations", courseId] });
      void qc.invalidateQueries({ queryKey: ["admin", "courses"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });


  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-sm" aria-label={assignmentCount ? "View assigned organizations for " + courseTitle : "Assign " + courseTitle + " to an organization"} />}>
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          {assignmentCount || "Assign"}
        </DialogTrigger>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Assigned organizations</DialogTitle>
            <DialogDescription>Review assignment details and remove every organization before making “{courseTitle}” public.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(420px,50vh)] overflow-y-auto rounded-lg border">
            {isLoading ? (
              <div className="space-y-3 p-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : organizations.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No organizations are currently assigned.</p>
            ) : (
              <div className="divide-y">
                {organizations.map((organization) => (
                  <div key={organization.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{organization.name}</p>
                        <Badge variant="outline" className="shrink-0 capitalize">{organization.status.toLowerCase()}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{organization.slug}{organization.domain ? " · " + organization.domain : ""}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{organization.adminEmail}</span>
                        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{organization.usedSeats} / {organization.seatCount} seats</span>
                        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />Assigned {new Date(organization.assignedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" onClick={() => setRemoveTarget(organization)} disabled={removeMutation.isPending}><Unlink className="h-3.5 w-3.5" />Unassign</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Plus className="h-4 w-4 text-primary" /> Assign this course to another organization
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={selectedOrgId} onValueChange={(value) => value && setSelectedOrgId(value)}>
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue placeholder={organizationsLoading ? "Loading organizations…" : "Select an organization"} />
                </SelectTrigger>
                <SelectContent>
                  {availableOrganizations.length === 0 ? (
                    <SelectItem value="__none__" disabled>No available organizations</SelectItem>
                  ) : availableOrganizations.map((organization) => (
                    <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => selectedOrgId && assignMutation.mutate(selectedOrgId)}
                disabled={!selectedOrgId || selectedOrgId === "__none__" || assignMutation.isPending || organizationsLoading}
              >
                <Plus className="h-3.5 w-3.5" /> Assign
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Only published courses can be assigned to organizations.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(value) => { if (!value && !removeMutation.isPending) setRemoveTarget(null); }}
        title={"Unassign “" + courseTitle + "”?"}
        description={"This will remove “" + courseTitle + "” from " + (removeTarget?.name ?? "this organization") + ". The course will remain unchanged otherwise."}
        confirmLabel="Unassign"
        pending={removeMutation.isPending}
        onConfirm={async () => { if (removeTarget) await removeMutation.mutateAsync(removeTarget.id); }}
      />
    </>
  );
}
