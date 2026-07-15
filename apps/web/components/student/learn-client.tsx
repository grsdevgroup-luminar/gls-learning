"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import type { Course, Lesson } from "@/types";
import { useStore } from "@/lib/context/store";
import { courseLessonCount } from "@/lib/mock/courses";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/endpoints";
import { useSession } from "@/lib/api/session";
import { ProtectedPlayer } from "@/components/player/protected-player";
import { QuizPlayer } from "@/components/student/quiz-player";
import { CircularProgress } from "@/components/shared/circular-progress";
import { StarRatingInput } from "@/components/shared/star-rating-input";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check, PlayCircle, FileText, HelpCircle, ChevronLeft, ChevronRight,
  CheckCircle2, Circle, Download, ArrowLeft, Star, Trophy, ChevronDown,
  Bookmark, Share2, MoreVertical, Sun, Moon, Link2, Flag,
} from "lucide-react";
import { lessonTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FlatLesson extends Lesson {
  sectionTitle: string;
  index: number;
}

export function LearnClient({ course }: { course: Course }) {
  const { isLessonDone, toggleLesson, completedCount, mounted } = useStore();
  const { user } = useSession();

  const flat: FlatLesson[] = useMemo(() => {
    let i = 0;
    return course.sections.flatMap((s) =>
      s.lessons.map((l) => ({ ...l, sectionTitle: s.title, index: i++ })),
    );
  }, [course]);

  const [currentId, setCurrentId] = useState(flat[0].id);
  const current = flat.find((l) => l.id === currentId) ?? flat[0];

  // Server-side quiz result for the current lesson (grading lives in the API).
  const { data: quizResult } = useQuery({
    queryKey: ["quiz-result", current.id],
    queryFn: () => api.quizResult(current.id),
    enabled: current.type === "quiz",
  });
  const total = courseLessonCount(course);
  const done = mounted ? completedCount(course.id) : 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

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
      {/* Top bar — course-player chrome (title left · learner actions right) */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/65 sm:px-4">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard" />} aria-label="Back to dashboard">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Logo className="hidden sm:flex" iconOnly />
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight">{course.title}</div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <RatingControl courseId={course.id} />
          <ProgressControl pct={pct} done={done} total={total} />
          <span aria-hidden className="mx-0.5 hidden h-6 w-px bg-border md:block" />
          <SaveControl />
          <ShareControl title={course.title} />
          <OverflowMenu slug={course.slug} />
        </div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[1fr_360px]">
        {/* Player + content */}
        <div className="flex flex-col">
          {current.type === "quiz" ? (
            <div className="bg-secondary/20">
              <QuizPlayer key={current.id} courseId={course.id} lessonId={current.id} />
            </div>
          ) : (
            <div className="bg-black p-0 lg:p-4">
              <div className="mx-auto w-full max-w-4xl">
                <ProtectedPlayer
                  key={current.id}
                  title={current.title}
                  durationSec={current.durationSec}
                  watermark={user?.email ?? ""}
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
                quizResult?.passed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
                    <CheckCircle2 className="h-4 w-4" /> Passed · {quizResult.bestScore}%
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {quizResult
                      ? `Best score so far: ${quizResult.bestScore}%`
                      : "Pass the quiz to mark this lesson complete"}
                  </span>
                )
              ) : (
                <Button
                  variant={isLessonDone(course.id, current.id) ? "secondary" : "default"}
                  onClick={() => toggleLesson(course.id, current.id)}
                >
                  {isLessonDone(course.id, current.id) ? <><CheckCircle2 className="animate-[complete-pop_0.4s_ease-out] text-success" /> Completed</> : <><Check /> Mark as complete</>}
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
                  In this lesson, <span className="font-medium text-foreground">{current.title}</span>, you&apos;ll build
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
          <div className="flex items-center justify-between gap-3 border-b p-4">
            <h2 className="font-semibold">Course content</h2>
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                <span
                  className="block h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{done}/{total}</span>
            </span>
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
                        <li
                          key={l.id}
                          className={cn(
                            "group/lesson relative flex items-stretch rounded-md transition-colors",
                            isCur
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-secondary/60",
                          )}
                        >
                          {isCur && (
                            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                          )}
                          {/* Mark / unmark — independent click target */}
                          <button
                            type="button"
                            onClick={() => {
                              toggleLesson(course.id, l.id);
                              toast.success(
                                isDone ? "Marked as not complete" : "Marked as complete",
                                { description: l.title },
                              );
                            }}
                            aria-pressed={isDone}
                            aria-label={isDone ? `Mark "${l.title}" as not complete` : `Mark "${l.title}" as complete`}
                            title={isDone ? "Mark as not complete" : "Mark as complete"}
                            className="flex shrink-0 items-center self-stretch rounded-l-md pl-2.5 pr-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4 text-success transition-transform group-hover/lesson:scale-110" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover/lesson:text-primary/60" />
                            )}
                          </button>
                          {/* Navigate to lesson */}
                          <button
                            type="button"
                            onClick={() => setCurrentId(l.id)}
                            className={cn(
                              "flex flex-1 items-start gap-2 rounded-r-md py-2 pr-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                              isCur ? "font-medium" : "group-hover/lesson:text-foreground",
                            )}
                          >
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

/* ── Top-bar controls ───────────────────────────────────────────────────── */

function RatingControl({ courseId }: { courseId: string }) {
  const { getMyReview, submitReview, mounted } = useStore();
  const existing = mounted ? getMyReview(courseId) : undefined;
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);

  const value = rating || existing?.rating || 0;

  function submit() {
    if (!value) {
      toast.error("Pick a star rating first");
      return;
    }
    submitReview(courseId, value, title || existing?.title || "", existing?.body || "");
    setOpen(false);
    toast.success("Thanks for your rating!", { description: `${value} of 5 stars` });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" />
        }
      >
        <Star className={cn("h-4 w-4", existing && "fill-amber-400 text-amber-400")} />
        <span className="hidden sm:inline">{existing ? "Your rating" : "Leave a rating"}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3">
        <div>
          <p className="font-heading text-sm font-semibold">How would you rate this course?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Your feedback helps other learners.</p>
        </div>
        <StarRatingInput value={value} onChange={setRating} size={26} className="justify-center py-1" />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={existing?.title || "Add a short headline (optional)"}
          className="h-8"
        />
        <Button size="sm" className="w-full" onClick={submit}>
          {existing ? "Update rating" : "Submit rating"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function ProgressControl({ pct, done, total }: { pct: number; done: number; total: number }) {
  const complete = pct >= 100;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:bg-transparent hover:text-foreground"
          />
        }
      >
        {/* Trophy sits inside a ring that fills live as lessons complete. */}
        <span className="relative grid size-8 place-items-center">
          {complete && (
            <>
              <span
                aria-hidden
                className="animate-trophy-halo absolute inset-0 rounded-full bg-primary/35 blur-md"
              />
              <Star
                aria-hidden
                fill="currentColor"
                className="animate-sparkle-twinkle absolute -right-1 -top-1 size-2.5 text-amber-300"
              />
              <Star
                aria-hidden
                fill="currentColor"
                className="animate-sparkle-twinkle absolute -bottom-1 -left-1 size-2 text-amber-300"
                style={{ animationDelay: "0.8s" }}
              />
            </>
          )}
          <CircularProgress value={pct} size={32} strokeWidth={3} showLabel={false} className="relative">
            <Trophy
              // key flips when crossing 100% so the celebrate animation replays
              key={complete ? "done" : "wip"}
              className={cn(
                "size-4.5 transition-colors",
                complete ? "animate-trophy-celebrate fill-primary/20 text-primary" : "text-primary",
              )}
            />
          </CircularProgress>
        </span>
        <span className="hidden tabular-nums sm:inline">Your progress</span>
        <ChevronDown className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 items-center gap-3 text-center">
        <span className="relative grid place-items-center">
          {complete && (
            <>
              <span
                aria-hidden
                className="animate-trophy-halo absolute inset-0 rounded-full bg-primary/30 blur-xl"
              />
              <Star
                aria-hidden
                fill="currentColor"
                className="animate-sparkle-twinkle absolute -right-2 -top-2 size-5 text-amber-300 drop-shadow-[0_0_4px_rgba(252,211,77,0.8)]"
              />
              <Star
                aria-hidden
                fill="currentColor"
                className="animate-sparkle-twinkle absolute -bottom-2 -left-2 size-4 text-amber-300 drop-shadow-[0_0_4px_rgba(252,211,77,0.8)]"
                style={{ animationDelay: "0.8s" }}
              />
            </>
          )}
          <CircularProgress value={pct} size={96} strokeWidth={8} showLabel={false} className="relative">
            {complete ? (
              <Trophy className="animate-trophy-celebrate size-9 fill-primary/20 text-primary" />
            ) : (
              <span className="text-lg font-bold tabular-nums">{pct}%</span>
            )}
          </CircularProgress>
        </span>
        <div>
          <p className="font-heading text-sm font-semibold">
            {complete ? "Course complete! 🎉" : `${done} of ${total} complete`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {complete
              ? "You finished every lesson — nice work!"
              : `${total - done} ${total - done === 1 ? "lesson" : "lessons"} to go`}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SaveControl() {
  const [saved, setSaved] = useState(false);
  return (
    <Button
      variant={saved ? "secondary" : "default"}
      size="sm"
      className="gap-1.5"
      aria-pressed={saved}
      onClick={() => {
        setSaved((s) => !s);
        toast.success(saved ? "Removed from saved" : "Saved to your list");
      }}
    >
      <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
      {saved ? "Saved" : "Save"}
    </Button>
  );
}

function ShareControl({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline">Share</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-2.5">
        <p className="font-heading text-sm font-semibold">Share this course</p>
        <p className="-mt-1 truncate text-xs text-muted-foreground">{title}</p>
        <div className="flex items-center gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5">
            <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs text-muted-foreground">{url}</span>
          </span>
          <Button size="sm" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : "Copy"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OverflowMenu({ slug }: { slug: string }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon-sm" aria-label="More options" />}
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Options</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
            {isDark ? <Sun /> : <Moon />} {isDark ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/courses/${slug}`} />}>
            <FileText /> Course details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast("Report submitted", { description: "Thanks — our team will review this content." })}>
            <Flag /> Report abuse
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard" />}>
          <ArrowLeft /> Back to dashboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
