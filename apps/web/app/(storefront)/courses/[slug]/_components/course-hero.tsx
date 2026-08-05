import type { CourseDetailDto } from "@skillstream/shared";
import { Stars } from "@/components/shared/stars";
import { BestsellerBadge, HighestRatedBadge, isHighestRated } from "@/components/shared/bestseller-badge";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Globe, Clock } from "lucide-react";
import { compactNumber, initials, relativeDate, levelLabel } from "@/lib/format";

/** Static, viewer-independent — safe to render on the server. */
export function CourseHero({ course }: { course: CourseDetailDto }) {
  const instructor = course.instructor;
  return (
    <section className="border-b bg-foreground text-background dark:bg-card dark:text-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-32 pt-10 lg:grid-cols-[1fr_380px] lg:pb-40">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{course.category}</Badge>
            {course.bestseller && <BestsellerBadge />}
            {isHighestRated(course) && <HighestRatedBadge />}
            <span className="text-sm opacity-80">{levelLabel(course.level)}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {course.title}
          </h1>
          <p className="mt-3 max-w-2xl text-lg opacity-90">{course.subtitle}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5">
              <Stars rating={course.ratingAvg} showValue size={15} />
              <span className="opacity-80">
                ({compactNumber(course.reviewCount)} ratings)
              </span>
            </span>
            <span className="flex items-center gap-1.5 opacity-90">
              <Users className="h-4 w-4" /> {compactNumber(course.studentCount)} students
            </span>
            <span className="flex items-center gap-1.5 opacity-90">
              <Globe className="h-4 w-4" /> {course.language}
            </span>
            <span className="flex items-center gap-1.5 opacity-90">
              <Clock className="h-4 w-4" /> Updated {relativeDate(course.updatedAt)}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                {instructor ? initials(instructor.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="opacity-90">
              Created by <span className="font-medium">{instructor?.name}</span>
            </span>
          </div>
        </div>

        {/* spacer for the floating card on desktop */}
        <div className="hidden lg:block" />
      </div>
    </section>
  );
}
