"use client";

import Link from "next/link";
import { useStore } from "@/lib/context/store";
import { useSession } from "@/lib/api/session";
import { useInstructorProfile } from "@/lib/api/hooks";
import { Section } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Clock, GraduationCap } from "lucide-react";
import { TeachHero } from "./_components/teach-hero";
import { TeachBenefits } from "./_components/teach-benefits";
import { ApplyInstructorForm } from "./_components/apply-instructor-form";
import { InstructorSignupForm } from "./_components/instructor-signup-form";

function StatusCard({
  tile, icon: Icon, title, body, action,
}: {
  tile: string;
  icon: typeof Clock;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <Card variant="elevated" className="items-center py-12 text-center">
      <CardContent className="flex flex-col items-center gap-3">
        <span className="icon-tile grid size-12 place-items-center" style={{ ["--tile" as string]: tile }}>
          <Icon className="size-6" />
        </span>
        <p className="font-heading text-lg font-semibold">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
        {action}
      </CardContent>
    </Card>
  );
}

export default function TeachPage() {
  const { role, mounted } = useStore();
  const { user } = useSession();
  const alreadyInstructor = mounted && role === "instructor";
  // Only fetched for a signed-in, not-yet-approved user — a guest has no
  // application to check, and an approved instructor already has its own
  // branch above.
  const { data: profile } = useInstructorProfile(!!user && !alreadyInstructor);

  function body() {
    if (alreadyInstructor) {
      return (
        <StatusCard
          tile="var(--tint-emerald)"
          icon={GraduationCap}
          title="You're already an instructor"
          body="Head to your instructor dashboard to manage courses and earnings."
          action={<Button render={<Link href="/instructor" />}>Go to dashboard <ArrowRight /></Button>}
        />
      );
    }
    // A pending application is its own identity, separate from "student" —
    // send them to check status rather than letting them submit a duplicate.
    if (user && profile?.status === "PENDING") {
      return (
        <StatusCard
          tile="var(--tint-amber)"
          icon={Clock}
          title="Your application is under review"
          body="We'll email you a decision within 1–2 business days. You can check your status anytime."
          action={<Button render={<Link href="/instructor" />} variant="outline">Check status</Button>}
        />
      );
    }
    // Signed in already (as a student, or reapplying after a rejection) —
    // apply using the existing account instead of creating a new one.
    if (user) return <ApplyInstructorForm />;
    // Logged out: the dedicated instructor journey — account + application
    // in one step, no detour through student signup.
    return <InstructorSignupForm />;
  }

  return (
    <>
      <TeachHero />
      <TeachBenefits />

      <Section size="sm" className="pb-24">
        <div className="mx-auto max-w-2xl">{body()}</div>
      </Section>
    </>
  );
}