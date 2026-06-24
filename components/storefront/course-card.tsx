import Link from "next/link";
import type { Course } from "@/types";
import { CourseArt } from "@/components/shared/course-art";
import { Stars } from "@/components/shared/stars";
import { Price } from "@/components/shared/price";
import { SpotlightCard } from "@/components/shared/motion";
import { getInstructor } from "@/lib/mock/instructors";
import { courseDurationMin, courseLessonCount } from "@/lib/mock/courses";
import { compactNumber, formatHoursFromMin } from "@/lib/format";
import { Clock, Users, Dot, PlayCircle, ArrowRight, Crown, Gauge } from "lucide-react";

export function CourseCard({ course }: { course: Course }) {
  const instructor = getInstructor(course.instructorId);
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <SpotlightCard className="h-full rounded-2xl">
        {/* SpotlightCard's children sit in a non-flex wrapper internally, so this
            div — not SpotlightCard's className — owns the actual card layout/gap. */}
        <div className="flex h-full flex-col gap-5 p-3">
          {/* Cinematic media — aurora ring + glow track the cursor, art zooms */}
          <div className="relative overflow-hidden rounded-xl border border-border bg-muted shadow-sm transition-shadow duration-300 group-hover:shadow-lg">
            <CourseArt
              seed={course.thumbnail}
              title={course.title}
              category={course.category}
              className="aspect-[16/10] transition-transform duration-[600ms] ease-out group-hover:scale-[1.06]"
            />
            {/* darkening + play affordance on hover */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="grid size-12 scale-75 place-items-center rounded-full bg-background/90 text-primary opacity-0 shadow-lg backdrop-blur transition-all duration-300 ease-out group-hover:scale-100 group-hover:opacity-100">
                <PlayCircle className="size-6" />
              </span>
            </div>
            {course.bestseller && (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-linear-to-r from-amber-400 to-orange-500 px-2 py-1 text-[11px] font-semibold tracking-wide text-white shadow-md ring-1 ring-white/20 transition-transform duration-300 group-hover:-translate-y-0.5">
                <Crown className="size-3" /> Bestseller
              </span>
            )}
          </div>

          {/* Editorial content — typography does the work, each fact appears once */}
          <div className="flex flex-1 flex-col">
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">
              <Gauge className="size-3" /> {course.level}
            </span>

            <h3 className="mt-3 text-[15px] font-semibold leading-snug tracking-tight line-clamp-2 text-foreground transition-colors duration-200 group-hover:text-primary">
              {course.title}
            </h3>
            <p className="mt-1 truncate text-[13px] text-muted-foreground">{instructor?.name}</p>

            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <Stars rating={course.rating} showValue size={13} />
              <span className="text-muted-foreground">({compactNumber(course.reviewCount)})</span>
              <Dot className="size-3 shrink-0 text-border" />
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Users className="size-3.5" /> {compactNumber(course.studentCount)}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> {formatHoursFromMin(courseDurationMin(course))}
              </span>
              <Dot className="size-3 shrink-0 text-border" />
              <span>{courseLessonCount(course)} lessons</span>
            </div>

            <div className="mt-auto flex items-end justify-between gap-2 border-t border-border/70 pt-3">
              <Price
                basePrice={course.basePrice}
                originalPrice={course.originalPrice}
                size="md"
                showLocal={false}
              />
              <span className="flex items-center gap-1 pb-0.5 text-xs font-semibold text-primary opacity-0 transition-all duration-300 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100">
                View
                <ArrowRight className="size-3.5" />
              </span>
            </div>
          </div>
        </div>
      </SpotlightCard>
    </Link>
  );
}
