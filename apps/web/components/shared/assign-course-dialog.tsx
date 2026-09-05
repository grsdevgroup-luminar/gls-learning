"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MAX_PAGE_SIZE } from "@skillstream/shared";
import { api, orgApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { CourseArt } from "@/components/shared/course-art";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

/**
 * Assigns a published course to an org (visibility flips to PRIVATE). Shared
 * between the org portal's own course-management page and the platform
 * admin's organizations table, so the assign/unassign flow exists once.
 */
export function AssignCourseDialog({
  orgId,
  assignedIds,
  renderTrigger,
  children,
}: {
  orgId: string;
  assignedIds: Set<string>;
  /** The element Base UI renders the trigger as — e.g. a styled `<Button />`.
   *  Defaults to a primary button; `children` (not this element's own
   *  children) supplies the visible trigger content. */
  renderTrigger?: React.ReactElement;
  children?: ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: catalog } = useQuery({
    queryKey: ["store", "courses"],
    queryFn: () => api.courses({ pageSize: MAX_PAGE_SIZE }),
    staleTime: 60_000,
    enabled: open,
  });

  const assignMutation = useMutation({
    mutationFn: (courseId: string) => orgApi.assignCourse(orgId, courseId),
    onSuccess: () => {
      toast.success("Course assigned to organization");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["org", orgId, "courses"] });
      void qc.invalidateQueries({ queryKey: ["admin-organizations"] });
      void qc.invalidateQueries({ queryKey: ["store", "courses"] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const available = (catalog?.items ?? []).filter((c) => !assignedIds.has(c.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={renderTrigger ?? <Button />}>
        {children ?? (<><Plus /> Assign course</>)}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign a course</DialogTitle>
        </DialogHeader>
        <div className="mt-2 max-h-100 space-y-2 overflow-y-auto">
          {available.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">All published courses are already assigned.</p>
          ) : (
            available.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
                <CourseArt seed={c.thumbnail} title={c.title} className="h-10 w-10 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{c.category} · {c.level}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => assignMutation.mutate(c.id)}
                  disabled={assignMutation.isPending}
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
