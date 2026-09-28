"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { partnerApi } from "@/lib/api/endpoints";
import { useLogout, useSession } from "@/lib/api/session";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Handshake, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PARAM = "partnerInvite";

/**
 * The delivery-partner invite accept/decline UI, surfaced as a dashboard
 * overlay rather than its own page. A raw visit to /join/partner/[token]
 * (email link, or an already-authenticated session) redirects here instead
 * of showing the accept modal directly — landing on the dashboard first,
 * with the invite surfaced via a notification (and this `?partnerInvite=`
 * param) rather than sprung on page load. See join/partner/[token]/page.tsx.
 */
export function PartnerInviteModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get(PARAM);
  const qc = useQueryClient();
  const { user } = useSession();
  const logout = useLogout();

  const { data: invite, isLoading } = useQuery({
    queryKey: ["partner-invite", token],
    queryFn: () => partnerApi.invitationInfo(token!),
    enabled: !!token,
  });

  const close = () => {
    const params = new URLSearchParams(searchParams);
    params.delete(PARAM);
    const qs = params.toString();
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard");
  };

  const claim = useMutation({
    mutationFn: () => partnerApi.claim(token!),
    onSuccess: (assignment) => {
      void qc.invalidateQueries();
      toast.success(`You now have access to ${assignment.course.title}!`);
      close();
    },
    onError: (err) => toast.error("Could not join", { description: getApiErrorMessage(err) }),
  });

  const decline = useMutation({
    mutationFn: () => partnerApi.decline(token!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["partner-invite", token] });
      toast.success("Invitation declined");
      close();
    },
    onError: (err) => toast.error("Could not decline", { description: getApiErrorMessage(err) }),
  });

  if (!token) return null;

  const wrongAccount =
    !!invite?.email && !!user?.email && invite.email.toLowerCase() !== user.email.toLowerCase();
  const busy = claim.isPending || decline.isPending;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) close(); }}>
      <DialogContent className="sm:max-w-sm">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Checking your invitation…</p>
          </div>
        ) : !invite?.valid ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogHeader>
              <DialogTitle>Invitation not valid</DialogTitle>
              <DialogDescription>
                This invite link is invalid, already used, or has expired.
              </DialogDescription>
            </DialogHeader>
            <Button variant="outline" className="w-full" onClick={close}>Close</Button>
          </div>
        ) : wrongAccount ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-warning/10 text-warning">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogHeader>
              <DialogTitle>Wrong account</DialogTitle>
              <DialogDescription>
                This invitation was sent to {invite.email} — you&apos;re signed in as {user?.email}.
                Log out and sign in with the invited address to continue.
              </DialogDescription>
            </DialogHeader>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => logout.mutate(undefined, {
                onSuccess: () => router.push(`/login?next=${encodeURIComponent(`/dashboard?${PARAM}=${token}`)}`),
              })}
            >
              Log out
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Handshake className="h-6 w-6" />
            </div>
            <DialogHeader>
              <DialogTitle>{`You've been invited to ${invite.courseTitle ?? "a course"}`}</DialogTitle>
              <DialogDescription>
                {`${invite.partnerName ?? "A delivery partner"} has given you free access to this course.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="w-full flex-col gap-2 sm:flex-col">
              <Button className="sheen w-full" disabled={busy} onClick={() => claim.mutate()}>
                {claim.isPending ? "Unlocking…" : "Accept"}
              </Button>
              <Button variant="outline" className="w-full" disabled={busy} onClick={() => decline.mutate()}>
                Decline
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
