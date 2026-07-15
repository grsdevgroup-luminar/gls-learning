"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { instructorApi } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Clock, ShieldCheck, XCircle, Mail, GraduationCap, Loader2 } from "lucide-react";

/**
 * Gates instructor tooling behind approval. Approved instructors see the
 * children; pending applicants see an "under review" state; rejected ones see
 * a decision notice. Status comes from the live instructor profile.
 */
export function ApprovalGate({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["instructor", "profile"],
    queryFn: instructorApi.profile,
  });

  if (isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile?.status === "APPROVED") return <>{children}</>;

  if (profile?.status === "REJECTED") {
    return (
      <Notice
        tone="rose"
        icon={XCircle}
        title="Application not approved"
        body="Thanks for applying. After review we're unable to onboard you as an instructor right now. You're welcome to strengthen your sample and re-apply in the future."
        action={<Button render={<Link href="/teach" />} variant="outline">Re-apply</Button>}
      />
    );
  }

  if (!profile) {
    return (
      <Notice
        tone="amber"
        icon={GraduationCap}
        title="You're not an instructor yet"
        body="Apply to teach on SkillStream — approved instructors unlock the full course builder, earnings and analytics."
        action={<Button render={<Link href="/teach" />}>Apply to teach</Button>}
      />
    );
  }

  return (
    <Notice
      tone="amber"
      icon={Clock}
      title="Your application is under review"
      body="Our team reviews new instructor applications within 1–2 business days. You can already set up your profile below — course creation unlocks the moment you're approved."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <Mail className="size-3.5" /> We'll email {profile.email} with the decision.
        </div>
      }
    />
  );
}

function Notice({
  tone,
  icon: Icon,
  title,
  body,
  action,
}: {
  tone: "amber" | "rose";
  icon: typeof Clock;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  const tint = tone === "amber" ? "var(--tint-amber)" : "var(--tint-rose)";
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="max-w-md text-center" style={{ ["--tile" as string]: tint }}>
        <span className="icon-tile mx-auto mb-5 grid size-14 place-items-center">
          <Icon className="size-7" />
        </span>
        <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
        <div className="mt-6 flex flex-col items-center gap-3">{action}</div>
        <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-success" /> Quality-reviewed marketplace
        </div>
      </div>
    </div>
  );
}
