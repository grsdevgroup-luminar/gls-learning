"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orgApi } from "@/lib/api/endpoints";
import { useSession } from "@/lib/api/session";
import { getApiErrorMessage } from "@/lib/api/errors";
import { InviteClaimShell } from "@/components/shared/invite-claim-shell";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated, isLoading: sessionLoading } = useSession();
  const claimed = useRef(false);

  const { data: invite, isLoading } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => orgApi.invitationInfo(token),
    enabled: !!token,
  });

  const claim = useMutation({
    mutationFn: () => orgApi.claim(token),
    onSuccess: (org) => {
      void qc.invalidateQueries();
      toast.success(`Welcome to ${org.name}!`);
      // Org admins manage from the org portal; members go to their team courses.
      router.push(invite?.role === "ADMIN" ? `/org/${org.slug}` : "/dashboard/team");
      router.refresh();
    },
    onError: (err) => toast.error("Could not join", { description: getApiErrorMessage(err) }),
  });

  // Auto-claim once the session is known and the user is signed in.
  useEffect(() => {
    if (!claimed.current && invite?.valid && isAuthenticated && !sessionLoading) {
      claimed.current = true;
      claim.mutate();
    }
  }, [invite?.valid, isAuthenticated, sessionLoading, claim]);

  return (
    <InviteClaimShell
      next={`/join/${token}`}
      isLoading={isLoading}
      sessionLoading={sessionLoading}
      isAuthenticated={isAuthenticated}
      valid={!!invite?.valid}
      email={invite?.email ?? null}
      claimPending={claim.isPending}
      claimSuccess={claim.isSuccess}
      icon={Building2}
      heroTitle={`You're invited to ${invite?.orgName ?? "an organization"}`}
      heroDescription={`Join as ${invite?.role === "ADMIN" ? "an admin" : "a member"} to access your company's courses.`}
      joiningLabel={`Joining ${invite?.orgName ?? "…"}…`}
    />
  );
}
