"use client";

import Link from "next/link";
import { useStore } from "@/lib/context/store";
import { Section } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, GraduationCap } from "lucide-react";
import { TeachHero } from "./_components/teach-hero";
import { TeachBenefits } from "./_components/teach-benefits";
import { ApplyInstructorForm } from "./_components/apply-instructor-form";

export default function TeachPage() {
  const { role, mounted } = useStore();
  const alreadyInstructor = mounted && role === "instructor";

  return (
    <>
      <TeachHero />
      <TeachBenefits />

      <Section size="sm" className="pb-24">
        <div className="mx-auto max-w-2xl">
          {alreadyInstructor ? (
            <Card variant="elevated" className="items-center py-12 text-center">
              <CardContent className="flex flex-col items-center gap-3">
                <span className="icon-tile grid size-12 place-items-center" style={{ ["--tile" as string]: "var(--tint-emerald)" }}>
                  <GraduationCap className="size-6" />
                </span>
                <p className="font-heading text-lg font-semibold">You&apos;re already an instructor</p>
                <p className="max-w-sm text-sm text-muted-foreground">Head to your instructor dashboard to manage courses and earnings.</p>
                <Button render={<Link href="/instructor" />}>Go to dashboard <ArrowRight /></Button>
              </CardContent>
            </Card>
          ) : (
            <ApplyInstructorForm />
          )}
        </div>
      </Section>
    </>
  );
}
