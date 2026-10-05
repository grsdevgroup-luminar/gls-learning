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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Building2, CalendarDays, Mail, Unlink, Users, Plus, Search, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

export function CourseOrganizationsDialog({ courseId, courseTitle, assignmentCount }: { courseId: string; courseTitle: string; assignmentCount: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AdminCourseOrganizationDto | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [organizationSearch, setOrganizationSearch] = useState("");
  const [organizationPickerOpen, setOrganizationPickerOpen] = useState(false);
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
  const normalizedOrganizationSearch = organizationSearch.trim().toLocaleLowerCase();
  const filteredOrganizations = availableOrganizations.filter((organization) =>
    [organization.name, organization.slug, organization.domain, organization.adminEmail]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(normalizedOrganizationSearch)),
  );
  const selectedOrganization = availableOrganizations.find((organization) => organization.id === selectedOrgId);
  const assignMutation = useMutation({
    mutationFn: (orgId: string) => orgApi.assignCourse(orgId, courseId),
    onSuccess: () => {
      toast.success("Course assigned");
      setSelectedOrgId("");
      setOrganizationSearch("");
      setOrganizationPickerOpen(false);
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
              <Popover
                open={organizationPickerOpen}
                onOpenChange={(nextOpen) => {
                  setOrganizationPickerOpen(nextOpen);
                  if (!nextOpen) setOrganizationSearch("");
                }}
              >
                <PopoverTrigger
                  disabled={organizationsLoading || availableOrganizations.length === 0}
                  render={<Button type="button" variant="outline" className="w-full justify-between font-normal sm:flex-1" />}
                >
                  <span className={selectedOrganization ? "truncate" : "truncate text-muted-foreground"}>
                    {selectedOrganization?.name ?? (organizationsLoading ? "Loading organizations…" : availableOrganizations.length === 0 ? "No available organizations" : "Select an organization")}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--anchor-width)] min-w-0 p-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={organizationSearch}
                      onChange={(event) => setOrganizationSearch(event.target.value)}
                      placeholder="Search organizations…"
                      aria-label="Search organizations to assign this course"
                      className="pl-8"
                    />
                  </div>
                  <div className="mt-1 max-h-56 overflow-y-auto">
                    {filteredOrganizations.length === 0 ? (
                      <p className="px-2 py-3 text-sm text-muted-foreground">
                        {availableOrganizations.length === 0 ? "No available organizations." : "No organizations match your search."}
                      </p>
                    ) : filteredOrganizations.map((organization) => (
                      <button
                        key={organization.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                        onClick={() => {
                          setSelectedOrgId(organization.id);
                          setOrganizationSearch("");
                          setOrganizationPickerOpen(false);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{organization.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{organization.domain || organization.slug}</span>
                        </span>
                        {selectedOrgId === organization.id && <Check className="size-4 shrink-0 text-primary" />}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
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
