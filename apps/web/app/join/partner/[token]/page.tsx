"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { partnerApi } from "@/lib/api/endpoints";
import { useSession } from "@/lib/api/session";
import { getApiErrorMessage } from "@/lib/api/errors";
import { InviteClaimShell } from "@/components/shared/invite-claim-shell";
import { Handshake } from "lucide-react";
import { toast } from "sonner";

/** Separate route from /join/[token] (org invites) rather than one endpoint
 *  trying to detect invite type from an opaque token — see
 *  DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §6.2. Shares all UI/state logic with
 *  the org claim page via InviteClaimShell; only copy, icon, and the
 *  post-claim redirect differ. */
export default function JoinPartnerPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated, isLoading: sessionLoading } = useSession();

  const { data: invite, isLoading } = useQuery({
    queryKey: ["partner-invite", token],
    queryFn: () => partnerApi.invitationInfo(token),
    enabled: !!token,
  });

  const claim = useMutation({
    mutationFn: () => partnerApi.claim(token),
    onSuccess: (assignment) => {
      void qc.invalidateQueries();
      toast.success(`You now have access to ${assignment.course.title}!`);
      router.push("/dashboard/partner-courses");
      router.refresh();
    },
    onError: (err) => toast.error("Could not join", { description: getApiErrorMessage(err) }),
  });

  return (
    <InviteClaimShell
      next={`/join/partner/${token}`}
      isLoading={isLoading}
      sessionLoading={sessionLoading}
      isAuthenticated={isAuthenticated}
      valid={!!invite?.valid}
      email={invite?.email ?? null}
      claimPending={claim.isPending}
      claimSuccess={claim.isSuccess}
      onAccept={() => claim.mutate()}
      onDecline={() => router.push("/")}
      icon={Handshake}
      heroTitle={`You've been invited to ${invite?.courseTitle ?? "a course"}`}
      heroDescription={`${invite?.partnerName ?? "A delivery partner"} has given you free access to this course.`}
      joiningLabel={`Unlocking ${invite?.courseTitle ?? "your course"}…`}
    />
  );
}
