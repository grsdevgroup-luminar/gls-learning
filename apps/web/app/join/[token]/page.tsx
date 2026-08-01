"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orgApi } from "@/lib/api/endpoints";
import { useSession } from "@/lib/api/session";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, AlertTriangle, LogIn, UserPlus, Loader2 } from "lucide-react";
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

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <Card className="border-border/80 shadow-xl">
        <CardContent className="space-y-5 pt-6">{children}</CardContent>
      </Card>
    </div>
  );

  if (isLoading || sessionLoading) {
    return shell(
      <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Checking your invitation…</p>
      </div>,
    );
  }

  if (!invite?.valid) {
    return shell(
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Invitation not valid</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This invite link is invalid, already used, or has expired. Ask your team admin to send a new one.
          </p>
        </div>
        <Link href="/" className="text-sm text-primary hover:underline">
          Back to home
        </Link>
      </div>,
    );
  }

  // Valid invite, signed in → claiming in progress.
  if (isAuthenticated) {
    return shell(
      <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Joining {invite.orgName}…</p>
      </div>,
    );
  }

  // Valid invite, signed out → offer signup (email prefilled) or login, returning here.
  const next = encodeURIComponent(`/join/${token}`);
  const signupHref = `/signup?next=${next}&email=${encodeURIComponent(invite.email ?? "")}`;
  const loginHref = `/login?next=${next}`;

  return shell(
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Building2 className="h-7 w-7" />
      </div>
      <div>
        <h1 className="text-xl font-bold">You&apos;re invited to {invite.orgName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Join as {invite.role === "ADMIN" ? "an admin" : "a member"} to access your company&apos;s courses.
          {invite.email ? ` Invitation sent to ${invite.email}.` : ""}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button className="sheen w-full" size="lg" onClick={() => router.push(signupHref)}>
          <UserPlus className="h-4 w-4" /> Create account &amp; join
        </Button>
        <Button variant="outline" className="w-full" size="lg" onClick={() => router.push(loginHref)}>
          <LogIn className="h-4 w-4" /> I already have an account
        </Button>
      </div>
    </div>,
  );
}
