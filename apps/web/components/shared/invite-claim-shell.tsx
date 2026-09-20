"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, LogIn, UserPlus, Loader2, type LucideIcon } from "lucide-react";

/**
 * Shared shell for every "claim an invite by email" flow (org invites and
 * delivery-partner member invites — see DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md
 * §6.2). The states (loading, invalid/expired, claim-in-progress, signed-out
 * offer) are identical between the two; only copy and the post-claim
 * redirect differ, both of which stay in each caller's own thin page.tsx
 * rather than being generalized here — the data-fetching hooks themselves
 * (useQuery/useMutation/useSession) can't cleanly be passed as props without
 * fighting the rules of hooks, so callers own those and pass the resolved
 * state down.
 */
export function InviteClaimShell({
  next,
  isLoading,
  sessionLoading,
  isAuthenticated,
  valid,
  email,
  claimPending,
  claimSuccess,
  icon: Icon,
  heroTitle,
  heroDescription,
  joiningLabel,
}: {
  /** Path to return to after signup/login — e.g. `/join/${token}` or `/join/partner/${token}`. */
  next: string;
  isLoading: boolean;
  sessionLoading: boolean;
  isAuthenticated: boolean;
  valid: boolean;
  email: string | null;
  claimPending: boolean;
  claimSuccess: boolean;
  icon: LucideIcon;
  heroTitle: string;
  heroDescription: string;
  joiningLabel: string;
}) {
  const router = useRouter();

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

  // Once a claim has gone through (or is in flight), the invite record
  // itself correctly flips to invalid on refetch — claimed invites aren't
  // reusable. Don't let that refetch race the post-claim redirect and flash
  // the "not valid" error over a join that actually succeeded.
  if (!valid && !claimPending && !claimSuccess) {
    return shell(
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Invitation not valid</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This invite link is invalid, already used, or has expired. Ask whoever sent it for a new one.
          </p>
        </div>
        <Link href="/" className="text-sm text-primary hover:underline">
          Back to home
        </Link>
      </div>,
    );
  }

  // Valid invite, signed in → claiming in progress (auto-claim runs in the caller).
  if (isAuthenticated) {
    return shell(
      <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">{joiningLabel}</p>
      </div>,
    );
  }

  // Valid invite, signed out → offer signup (email prefilled) or login, returning here.
  const nextParam = encodeURIComponent(next);
  const signupHref = `/signup?next=${nextParam}&email=${encodeURIComponent(email ?? "")}`;
  const loginHref = `/login?next=${nextParam}`;

  return shell(
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <h1 className="text-xl font-bold">{heroTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {heroDescription}
          {email ? ` Invitation sent to ${email}.` : ""}
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
    </div>
  );
}
