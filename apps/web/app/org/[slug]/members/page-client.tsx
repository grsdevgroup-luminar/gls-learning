"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orgApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { initials, relativeDate } from "@/lib/format";
import { ReasonConfirmDialog } from "@/components/shared/reason-confirm-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { StudentProfileDialog } from "@/components/shared/student-profile-dialog";
import { UserPlus, Trash2, Search, Users, MailPlus, X, Eye } from "lucide-react";
import { toast } from "sonner";
import { useDebouncedSearch } from "@/lib/use-debounced-value";

export default function OrgMembers() {
  const params = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const { data: org } = useQuery({
    queryKey: ["org", params.slug],
    queryFn: () => orgApi.bySlug(params.slug),
    enabled: !!params.slug,
  });
  const { data: invitations } = useQuery({
    queryKey: ["org", org?.id, "invitations"],
    queryFn: () => orgApi.invitations(org!.id),
    enabled: !!org?.id,
  });
  const {
    data: selectedProfile,
    isLoading: isProfileLoading,
    error: profileError,
  } = useQuery({
    queryKey: ["org", org?.id, "member-profile", selectedMemberId],
    queryFn: () => orgApi.memberProfile(org!.id, selectedMemberId!),
    enabled: !!org?.id && !!selectedMemberId,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["org", params.slug] });
    void qc.invalidateQueries({ queryKey: ["org", org?.id, "invitations"] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => orgApi.invite(org!.id, email.trim()),
    onSuccess: () => {
      toast.success(`Invited ${email}`, { description: "They'll get access when they claim the invite." });
      setEmail("");
      setInviteOpen(false);
      refresh();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: ({ memberId, reason }: { memberId: string; reason: string }) =>
      orgApi.removeMember(org!.id, memberId, reason),
    onSuccess: () => {
      toast.success("Member removed");
      refresh();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (inviteId: string) => orgApi.cancelInvitation(org!.id, inviteId),
    onSuccess: () => {
      toast.success("Invitation cancelled");
      refresh();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  if (!org) return null;

  const filtered = org.members.filter(
    (m) => !q || `${m.name} ${m.email}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground">
            {org.usedSeats} of {org.seatCount} seats used.
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger render={<Button />}>
            <UserPlus /> Invite member
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Invite a member</DialogTitle>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              <div className="space-y-1">
                <Label>Email address</Label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => inviteMutation.mutate()}
                  disabled={!email.trim() || inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? "Sending…" : "Send invite"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search members…" className="search-input border-input bg-background pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30" />
        </div>
      </div>

      {(invitations ?? []).length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {(invitations ?? []).map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <MailPlus className="h-4 w-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{inv.email}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    · pending {inv.role.toLowerCase()} invite
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => cancelInviteMutation.mutate(inv.id)}
                  aria-label="Cancel invitation"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="h-6 w-6" />
                      <span className="text-sm">No members found.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{initials(m.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">{m.name}</div>
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={m.role === "ADMIN" ? "text-primary" : "text-muted-foreground"}>
                        {m.role.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {relativeDate(m.joinedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {m.userId && m.role !== "ADMIN" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="View profile"
                            onClick={() => setSelectedMemberId(m.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {m.role !== "ADMIN" && (
                          <ReasonConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                aria-label="Remove member"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            }
                            title={`Remove ${m.name}?`}
                            description="They will lose access to this organization's courses. They'll be notified with the reason below."
                            reasonLabel="Reason for removal"
                            reasonPlaceholder="e.g. No longer with the company"
                            confirmLabel="Remove"
                            pending={removeMutation.isPending}
                            onConfirm={async (reason) => {
                              await removeMutation.mutateAsync({ memberId: m.id, reason });
                            }}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <StudentProfileDialog
        student={selectedProfile}
        open={!!selectedMemberId}
        loading={isProfileLoading}
        error={profileError}
        onOpenChange={(open) => {
          if (!open) setSelectedMemberId(null);
        }}
      />
    </div>
  );
}
