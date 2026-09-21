"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { partnerApi } from "@/lib/api/endpoints";
import type { DeliveryPartnerCourseAssignmentDto } from "@skillstream/shared";
import { getApiErrorMessage } from "@/lib/api/errors";
import { relativeDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Mail, X, Users } from "lucide-react";
import { toast } from "sonner";

/**
 * Per-course-assignment member/invite management — a delivery partner's
 * equivalent of the org members page, scoped one level deeper (one course,
 * not the whole partner) since access is per-course (see
 * DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §3/§6).
 */
export function ManageMembersDialog({
  assignment,
}: {
  assignment: DeliveryPartnerCourseAssignmentDto;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["delivery-partner", "courses", assignment.id, "members"],
    queryFn: () => partnerApi.members(assignment.id),
    enabled: open,
  });
  const { data: invitations, isLoading: invitesLoading } = useQuery({
    queryKey: ["delivery-partner", "courses", assignment.id, "invitations"],
    queryFn: () => partnerApi.invitations(assignment.id),
    enabled: open,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["delivery-partner", "courses", assignment.id] });
    void qc.invalidateQueries({ queryKey: ["me", "delivery-partner", "courses"] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => partnerApi.invite(assignment.id, email.trim()),
    onSuccess: () => {
      toast.success(`Invited ${email}`, { description: "They'll get access when they accept." });
      setEmail("");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => partnerApi.revokeInvitation(inviteId),
    onSuccess: () => { toast.success("Invitation revoked"); invalidate(); },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const removeMutation = useMutation({
    mutationFn: (memberId: string) => partnerApi.removeMember(memberId),
    onSuccess: () => { toast.success("Member removed"); invalidate(); },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const unlimited = assignment.memberCap === 0;
  const seatsFull = !unlimited && assignment.usedSeats >= assignment.memberCap;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEmail(""); }}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <Users className="h-3.5 w-3.5" />
        {unlimited ? `${assignment.usedSeats} members` : `${assignment.usedSeats}/${assignment.memberCap} members`}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{assignment.course.title} — members</DialogTitle>
          <DialogDescription>
            Invite people by email to give them free access to this course.{" "}
            {unlimited
              ? `${assignment.usedSeats} members so far — unlimited seats.`
              : `${assignment.usedSeats} of ${assignment.memberCap} seats used.`}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            if (seatsFull) {
              toast.error("No seats remaining for this course");
              return;
            }
            inviteMutation.mutate();
          }}
        >
          <Input
            type="email"
            placeholder="member@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={seatsFull}
          />
          <Button type="submit" disabled={inviteMutation.isPending || seatsFull || !email.trim()}>
            <UserPlus className="h-4 w-4" /> Invite
          </Button>
        </form>
        {seatsFull && (
          <p className="text-xs text-warning">This course is full — remove a member or ask an admin to raise the cap.</p>
        )}

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Members ({members?.length ?? 0})
            </p>
            <div className="space-y-2">
              {membersLoading ? (
                <Skeleton className="h-10 rounded-lg" />
              ) : !members || members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              ) : (
                members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{m.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{m.email} · joined {relativeDate(m.joinedAt)}</div>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove member"
                      onClick={() => removeMutation.mutate(m.id)}
                      disabled={removeMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pending invitations ({invitations?.length ?? 0})
            </p>
            <div className="space-y-2">
              {invitesLoading ? (
                <Skeleton className="h-10 rounded-lg" />
              ) : !invitations || invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending invitations.</p>
              ) : (
                invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                    <Mail className="h-4 w-4 shrink-0 text-warning" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{inv.email}</span>{" "}
                      <span className="text-xs text-muted-foreground">· pending invite</span>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Revoke invitation"
                      onClick={() => revokeMutation.mutate(inv.id)}
                      disabled={revokeMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
