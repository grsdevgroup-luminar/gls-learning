import type { CourseDetailDto } from "@skillstream/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Stars } from "@/components/shared/stars";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, PlayCircle, FileText, HelpCircle, Lock, Users, BarChart3 } from "lucide-react";
import { courseDurationMin, courseLessonCount } from "@/lib/course-stats";
import { compactNumber, formatHoursFromMin, lessonTime, initials } from "@/lib/format";

/** "What you'll learn" + curriculum + requirements/description + instructor
 *  bio — none of it depends on the viewer, so it renders on the server. The
 *  <Accordion> primitive is itself a client component internally; that's a
 *  self-contained boundary and doesn't force this component to be one too. */
export function CourseCurriculum({ course }: { course: CourseDetailDto }) {
  const instructor = course.instructor;
  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 text-xl font-bold">What you&apos;ll learn</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {course.whatYouLearn.map((w) => (
              <div key={w} className="flex gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-bold">Course content</h2>
          <span className="text-sm text-muted-foreground">
            {course.sections.length} sections · {courseLessonCount(course)} lessons ·{" "}
            {formatHoursFromMin(courseDurationMin(course))}
          </span>
        </div>
        <Card className="p-0">
          <Accordion defaultValue={course.sections[0] ? [course.sections[0].id] : []}>
            {course.sections.map((s) => (
              <AccordionItem key={s.id} value={s.id} className="px-4">
                <AccordionTrigger>
                  <div className="flex w-full items-center justify-between pr-3">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {s.lessons.length} lessons
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-1 pb-2">
                    {s.lessons.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                      >
                        {l.type === "VIDEO" ? (
                          <PlayCircle className="h-4 w-4 text-muted-foreground" />
                        ) : l.type === "QUIZ" ? (
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="flex-1">{l.title}</span>
                        {l.preview ? (
                          <Badge variant="outline" className="h-5 text-[10px]">
                            Preview
                          </Badge>
                        ) : (
                          <Lock className="h-3 w-3 text-muted-foreground/60" />
                        )}
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {lessonTime(l.durationSec)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-bold">Requirements</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {course.requirements.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <h2 className="mb-3 mt-8 text-xl font-bold">Description</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {course.description}
        </p>
      </div>

      {instructor && (
        <div>
          <h2 className="mb-4 text-xl font-bold">Your instructor</h2>
          <Card>
            <CardContent className="flex gap-4 pt-6">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="brand-gradient text-lg text-white">
                  {initials(instructor.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{instructor.name}</h3>
                <p className="text-sm text-muted-foreground">{instructor.title}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Stars rating={instructor.ratingAvg ?? 0} size={12} showValue /> rating
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {compactNumber(instructor.studentCount ?? 0)} students
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5" /> {instructor.courseCount ?? 0} courses
                  </span>
                </div>
                <p className="mt-3 text-sm">{instructor.bio}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
