"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Course, Lesson } from "@/types";
import { useStore } from "@/lib/context/store";
import { courseLessonCount } from "@/lib/mock/courses";
import { demoStudent } from "@/lib/mock/students";
import { ProtectedPlayer } from "@/components/player/protected-player";
import { QuizPlayer } from "@/components/student/quiz-player";
import { Meter } from "@/components/shared/meter";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check, PlayCircle, FileText, HelpCircle, ChevronLeft, ChevronRight,
  CheckCircle2, Circle, Download, ArrowLeft, Timer,
} from "lucide-react";
import { lessonTime } from "@/lib/format";
import { toast } from "sonner";

interface FlatLesson extends Lesson {
  sectionTitle: string;
  index: number;
}

export function LearnClient({ course }: { course: Course }) {
  const { isLessonDone, toggleLesson, completedCount, getQuizResult, mounted } = useStore();

  const flat: FlatLesson[] = useMemo(() => {
    let i = 0;
    return course.sections.flatMap((s) =>
      s.lessons.map((l) => ({ ...l, sectionTitle: s.title, index: i++ })),
    );
  }, [course]);

  const [currentId, setCurrentId] = useState(flat[0].id);
  const current = flat.find((l) => l.id === currentId) ?? flat[0];
  const total = courseLessonCount(course);
  const done = mounted ? completedCount(course.id) : 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Session timer — elegant Notion-style focus tracker
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const sessionClock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;

  function markAndMaybeAdvance() {
    if (!isLessonDone(course.id, current.id)) {
      toggleLesson(course.id, current.id);
      toast.success("Lesson complete!", { description: current.title });
    }
  }
  function goto(delta: number) {
    const next = flat[current.index + delta];
    if (next) setCurrentId(next.id);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 items-center gap-3 border-b px-4">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard" />} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Logo className="hidden sm:flex" />
        <div className="mx-2 hidden h-6 w-px bg-border sm:block" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{course.title}</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground sm:inline-flex">
            <Timer className="size-3.5" /> {sessionClock}
          </span>
          <div className="hidden items-center gap-2 sm:flex">
            <Meter value={pct} className="w-28" height={6} />
            <span className="text-xs font-medium tabular-nums text-muted-foreground">{pct}%</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[1fr_360px]">
        {/* Player + content */}
        <div className="flex flex-col">
          {current.type === "quiz" && current.quiz ? (
            <div className="bg-secondary/20">
              <QuizPlayer
                key={current.id}
                courseId={course.id}
                lessonId={current.id}
                quiz={current.quiz}
              />
            </div>
          ) : (
            <div className="bg-black p-0 lg:p-4">
              <div className="mx-auto w-full max-w-4xl">
                <ProtectedPlayer
                  key={current.id}
                  title={current.title}
                  durationSec={current.durationSec}
                  watermark={demoStudent.email}
                  seed={course.thumbnail}
                  onComplete={markAndMaybeAdvance}
                  onNext={() => goto(1)}
                />
              </div>
            </div>
          )}

          <div className="mx-auto w-full max-w-4xl flex-1 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{current.sectionTitle}</p>
                <h1 className="text-xl font-bold">{current.title}</h1>
              </div>
              {current.type === "quiz" ? (
                (() => {
                  const result = mounted ? getQuizResult(course.id, current.id) : undefined;
                  return result?.passed ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
                      <CheckCircle2 className="h-4 w-4" /> Passed · {result.bestScore}%
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {result ? `Best score so far: ${result.bestScore}%` : "Pass the quiz to mark this lesson complete"}
                    </span>
                  );
                })()
              ) : (
                <Button
                  variant={isLessonDone(course.id, current.id) ? "secondary" : "default"}
                  onClick={() => toggleLesson(course.id, current.id)}
                >
                  {isLessonDone(course.id, current.id) ? <><CheckCircle2 className="text-success" /> Completed</> : <><Check /> Mark as complete</>}
                </Button>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => goto(-1)} disabled={current.index === 0}>
                <ChevronLeft /> Previous
              </Button>
              <span className="text-xs text-muted-foreground">Lesson {current.index + 1} of {total}</span>
              <Button variant="outline" size="sm" onClick={() => goto(1)} disabled={current.index === total - 1}>
                Next <ChevronRight />
              </Button>
            </div>

            <Tabs defaultValue="overview" className="mt-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="pt-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  In this lesson, <span className="font-medium text-foreground">{current.title}</span>, you'll build
                  practical, hands-on understanding through clear examples. Follow along with the
                  protected video — your progress saves automatically.
                </p>
                <p className="mt-3">
                  This {lessonTime(current.durationSec)} {current.type} is part of the “{current.sectionTitle}” section.
                </p>
              </TabsContent>
              <TabsContent value="resources" className="pt-4">
                {current.resources?.length ? (
                  <ul className="space-y-2">
                    {current.resources.map((r) => (
                      <li key={r.name} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="flex-1">{r.name}</span>
                        <span className="text-xs text-muted-foreground">{r.size}</span>
                        <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No downloadable resources for this lesson.</p>
                )}
              </TabsContent>
              <TabsContent value="notes" className="pt-4">
                <Textarea placeholder="Take notes for this lesson… (saved locally in the demo)" className="min-h-32" />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Curriculum sidebar */}
        <aside className="border-t lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Course content</h2>
            <span className="text-xs text-muted-foreground">{done}/{total} done</span>
          </div>
          <Accordion defaultValue={course.sections.map((s) => s.id)} className="max-h-[calc(100vh-7rem)] overflow-y-auto">
            {course.sections.map((s) => (
              <AccordionItem key={s.id} value={s.id} className="px-3">
                <AccordionTrigger>
                  <span className="text-sm font-medium">{s.title}</span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="pb-1">
                    {s.lessons.map((l) => {
                      const isCur = l.id === current.id;
                      const isDone = mounted && isLessonDone(course.id, l.id);
                      return (
                        <li key={l.id}>
                          <button
                            onClick={() => setCurrentId(l.id)}
                            className={`relative flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                              isCur
                                ? "bg-primary/10 font-medium text-primary"
                                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                            }`}
                          >
                            {isCur && (
                              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                            )}
                            {isDone ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                            ) : (
                              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                            )}
                            <span className="flex-1">{l.title}</span>
                            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                              {l.type === "video" ? <PlayCircle className="h-3 w-3" /> : l.type === "quiz" ? <HelpCircle className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                              {lessonTime(l.durationSec)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </aside>
      </div>
    </div>
  );
}
