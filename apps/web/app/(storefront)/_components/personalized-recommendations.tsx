"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { CourseCard } from "./course-card";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/shared/section";
import { useRecommendedCourses } from "@/lib/api/hooks";
import { useSession } from "@/lib/api/session";
import { Skeleton } from "@/components/ui/skeleton";

/** A signed-in learner sees only categories chosen in the sign-up modal. */
export function PersonalizedRecommendations() {
  const { isAuthenticated, isLoading: sessionLoading } = useSession();
  const { data: courses, isLoading } = useRecommendedCourses(4, isAuthenticated);

  if (sessionLoading || !isAuthenticated) return null;
  if (isLoading) {
    return (
      <Section tinted size="lg">
        <Skeleton className="mb-8 h-10 w-72" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-80 rounded-2xl" />)}
        </div>
      </Section>
    );
  }
  if (!courses?.length) return null;

  return (
    <Section tinted size="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Chosen for you"
          title="Recommended for your interests"
          sub="Courses selected from the learning areas you chose when you joined."
        />
        <Button variant="ghost" render={<Link href="/dashboard" />}>
          View my feed <ArrowRight />
        </Button>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {courses.map((course) => <CourseCard key={course.id} course={course} />)}
      </div>
      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" /> Personalized using your three selected categories
      </p>
    </Section>
  );
}
