"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { partnerApi } from "@/lib/api/endpoints";
import { useSession } from "@/lib/api/session";
import { InviteClaimShell } from "@/components/shared/invite-claim-shell";
import { Handshake, Loader2 } from "lucide-react";

/** Separate route from /join/[token] (org invites) rather than one endpoint
 *  trying to detect invite type from an opaque token — see
 *  DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §6.2. Shares all UI/state logic with
 *  the org claim page via InviteClaimShell; only copy, icon, and the
 *  post-claim redirect differ.
 *
 *  Once the visitor is authenticated (whether they already had a session, or
 *  just finished signup/login via the `next` redirect below) this page
 *  hands off to the dashboard instead of showing the accept/decline modal
 *  itself — the modal reappears there as an overlay (PartnerInviteModal,
 *  driven by the `?partnerInvite=` param) once they land on it, or whenever
 *  they click the "you've been invited" notification. A signed-out visitor
 *  still sees the normal signup/login prompt here first. */
export default function JoinPartnerPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: sessionLoading } = useSession();

  const { data: invite, isLoading } = useQuery({
    queryKey: ["partner-invite", token],
    queryFn: () => partnerApi.invitationInfo(token),
    enabled: !!token,
  });

  const wrongAccount =
    isAuthenticated && !!invite?.email && !!user?.email &&
    invite.email.toLowerCase() !== user.email.toLowerCase();
  const handoffToDashboard = isAuthenticated && !!invite?.valid && !wrongAccount;

  useEffect(() => {
    if (!sessionLoading && !isLoading && handoffToDashboard) {
      router.replace(`/dashboard?partnerInvite=${token}`);
    }
  }, [sessionLoading, isLoading, handoffToDashboard, router, token]);

  if (handoffToDashboard) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <InviteClaimShell
      next={`/join/partner/${token}`}
      isLoading={isLoading}
      sessionLoading={sessionLoading}
      isAuthenticated={isAuthenticated}
      sessionEmail={user?.email ?? null}
      valid={!!invite?.valid}
      email={invite?.email ?? null}
      claimPending={false}
      claimSuccess={false}
      // Accept/decline never renders from this page — an authenticated,
      // valid, own-account invite is intercepted by handoffToDashboard above
      // before InviteClaimShell would reach that branch.
      onAccept={() => {}}
      onDecline={() => {}}
      icon={Handshake}
      heroTitle={`You've been invited to ${invite?.courseTitle ?? "a course"}`}
      heroDescription={`${invite?.partnerName ?? "A delivery partner"} has given you free access to this course.`}
      joiningLabel={`Unlocking ${invite?.courseTitle ?? "your course"}…`}
    />
  );
}
