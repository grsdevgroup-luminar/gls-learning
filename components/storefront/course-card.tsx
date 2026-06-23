import Link from "next/link";
import type { Course } from "@/types";
import { CourseArt } from "@/components/shared/course-art";
import { Stars } from "@/components/shared/stars";
import { Price } from "@/components/shared/price";
import { getInstructor } from "@/lib/mock/instructors";
import { courseDurationMin, courseLessonCount } from "@/lib/mock/courses";
import { compactNumber, formatHoursFromMin } from "@/lib/format";
import { Clock, Users, Dot } from "lucide-react";

export function CourseCard({ course }: { course: Course }) {
  const instructor = getInstructor(course.instructorId);
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group block h-full focus-visible:outline-none"
    >
      <article className="flex h-full flex-col">
        {/* Cinematic media — large, with a quiet hover zoom */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-muted shadow-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
          <CourseArt
            seed={course.thumbnail}
            title={course.title}
            category={course.category}
            className="aspect-[16/10] transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          {course.bestseller && (
            <span className="absolute left-3 top-3 rounded-md bg-background/90 px-2 py-1 text-[11px] font-semibold tracking-wide text-foreground shadow-sm backdrop-blur">
              Bestseller
            </span>
          )}
        </div>

        {/* Editorial content — typography does the work */}
        <div className="flex flex-1 flex-col pt-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span>{course.category}</span>
            <Dot className="size-3 shrink-0 text-border" />
            <span>{course.level}</span>
          </div>

          <h3 className="mt-2 text-[15px] font-semibold leading-snug tracking-tight line-clamp-2 text-foreground transition-colors group-hover:text-primary">
            {course.title}
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">{instructor?.name}</p>

          <div className="mt-3 flex items-center gap-2 text-xs">
            <Stars rating={course.rating} showValue size={13} />
            <span className="text-muted-foreground">
              ({compactNumber(course.reviewCount)})
            </span>
          </div>

          <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {formatHoursFromMin(courseDurationMin(course))}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {compactNumber(course.studentCount)}
            </span>
            <span>{courseLessonCount(course)} lessons</span>
          </div>

          <div className="mt-auto pt-4">
            <Price
              basePrice={course.basePrice}
              originalPrice={course.originalPrice}
              size="md"
              showLocal={false}
            />
          </div>
        </div>
      </article>
    </Link>
  );
}
