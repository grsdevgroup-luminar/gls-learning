"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Download, FileText, HelpCircle, PlayCircle, Presentation } from "lucide-react";
import type { LessonPublicDto } from "@skillstream/shared";
import { api, orgApi } from "@/lib/api/endpoints";
import { useSession } from "@/lib/api/session";
import { ProtectedPlayer } from "@/components/player/protected-player";
import { Button } from "@/components/ui/button";
import { PptxViewer } from "../../../../learn/[slug]/_components/pptx-viewer";

type LessonItem = LessonPublicDto & { sectionTitle: string };

export function OrgCourseViewer() {
  const params = useParams<{ slug: string; courseId: string }>();
  const { user } = useSession();
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [contentSelection, setContentSelection] = useState<{
    lessonId: string;
    mode: "video" | "slides";
  } | null>(null);
  const { data: org } = useQuery({
    queryKey: ["org", params.slug],
    queryFn: () => orgApi.bySlug(params.slug),
    enabled: !!params.slug,
  });
  const { data: course, isLoading, error } = useQuery({
    queryKey: ["org-course-preview", org?.id, params.courseId],
    queryFn: () => orgApi.coursePreview(org!.id, params.courseId),
    enabled: !!org?.id && !!params.courseId,
  });

  if (isLoading || !org) return <div className="p-8 text-sm text-muted-foreground">Loading course…</div>;
  if (error || !course) return <div className="p-8 text-sm text-destructive">This course is unavailable or is no longer assigned to your organization.</div>;

  const lessons: LessonItem[] = course.sections.flatMap((section) =>
    section.lessons.map((lesson) => ({ ...lesson, sectionTitle: section.title })),
  );
  const selected = lessons.find((lesson) => lesson.id === activeLessonId) ?? lessons[0];

  const defaultContentMode = selected?.type === "VIDEO" && !selected.hasVideo && selected.pptx?.url
    ? "slides"
    : "video";
  const contentMode = selected && contentSelection?.lessonId === selected.id
    ? contentSelection.mode
    : defaultContentMode;

  return (
    <div className="space-y-5 p-4 md:p-8">
      <Button variant="ghost" size="sm" render={<Link href={`/org/${params.slug}/courses`} />}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Assigned courses
      </Button>
      <div>
        <p className="text-sm text-muted-foreground">Read-only organization course access</p>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{course.subtitle}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-4 rounded-xl border bg-card p-4 md:p-6">
          {!selected ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No lessons are available in this course yet.</div>
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground">{selected.sectionTitle}</p>
                <h2 className="text-lg font-semibold">{selected.title}</h2>
              </div>
              {selected.type === "VIDEO" && selected.pptx?.url && (
                <div className="flex w-fit items-center gap-1 rounded-full border bg-muted p-1">
                  <button
                    type="button"
                    aria-pressed={contentMode === "video"}
                    onClick={() => setContentSelection({ lessonId: selected.id, mode: "video" })}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${contentMode === "video" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <span className="flex items-center gap-1.5"><PlayCircle className="h-4 w-4" /> Video</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={contentMode === "slides"}
                    onClick={() => setContentSelection({ lessonId: selected.id, mode: "slides" })}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${contentMode === "slides" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <span className="flex items-center gap-1.5"><Presentation className="h-4 w-4" /> Slides</span>
                  </button>
                </div>
              )}
              {selected.type === "VIDEO" ? (
                contentMode === "slides" && selected.pptx?.url ? (
                  <PptxViewer key={selected.id} url={selected.pptx.url} />
                ) : (
                selected.hasVideo ? (
                  <ProtectedPlayer
                    lessonId={selected.id}
                    title={selected.title}
                    watermark={user?.email ?? "Organization preview"}
                    seed={course.thumbnail}
                    resume={false}
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">Video is not available yet.</div>
                )
                )
              ) : selected.type === "ARTICLE" ? (
                <article className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-lg border p-5">
                  {selected.articleContent || "No article content is available."}
                </article>
              ) : (
                <ReadOnlyQuiz lessonId={selected.id} />
              )}

              {(selected.resources.length > 0 || selected.pptx?.url) && (
                <section className="space-y-2 border-t pt-4">
                  <h3 className="text-sm font-semibold">Lesson resources</h3>
                  {selected.pptx?.url && <ResourceLink href={selected.pptx.url} name={selected.pptx.name} />}
                  {selected.resources.map((resource, index) => (
                    <ResourceLink key={`${resource.name}-${index}`} href={resource.url} name={resource.name} />
                  ))}
                </section>
              )}
            </>
          )}
        </main>

        <aside className="h-fit rounded-xl border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4" /> Course content</h2>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            {course.sections.map((section) => (
              <section key={section.id}>
                <h3 className="mb-1 text-xs font-medium text-muted-foreground">{section.title}</h3>
                <div className="space-y-1">
                  {section.lessons.map((lesson) => {
                    const Icon = lesson.type === "VIDEO" ? PlayCircle : lesson.type === "ARTICLE" ? FileText : HelpCircle;
                    return (
                      <button key={lesson.id} onClick={() => setActiveLessonId(lesson.id)} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted ${selected?.id === lesson.id ? "bg-muted font-medium" : ""}`}>
                        <Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 truncate">{lesson.title}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </aside>
      </div>
      <p className="text-xs text-muted-foreground">Viewing course content does not enroll you or record lesson progress.</p>
    </div>
  );
}

function ResourceLink({ href, name }: { href: string; name: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"><Download className="h-4 w-4" />{name}</a>;
}

function ReadOnlyQuiz({ lessonId }: { lessonId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["org-readonly-quiz", lessonId],
    queryFn: () => api.quiz(lessonId),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading quiz questions…</p>;
  if (error || !data) return <p className="text-sm text-muted-foreground">Quiz questions are unavailable.</p>;
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">Read-only preview · {data.passScore}% pass score</p>
      {data.questions.map((question, index) => (
        <section key={question.id} className="space-y-2">
          <h3 className="font-medium">{index + 1}. {question.prompt}</h3>
          <ul className="space-y-1 pl-4 text-sm text-muted-foreground">
            {question.options.map((option) => <li key={option.id} className="list-disc">{option.text}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
