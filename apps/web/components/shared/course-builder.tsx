"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MAX_COURSE_DESCRIPTION_LENGTH,
  type CourseDetailDto,
  type LessonResourceDto,
} from "@skillstream/shared";
import { useCategories } from "@/lib/api/hooks";
import { authoringApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { formatBytes } from "@/lib/format";
import { VideoUpload } from "@/components/shared/video-upload";
import { QuizEditor, emptyQuiz, type BuilderQuiz } from "@/components/shared/quiz-editor";
import { CourseArt, isImageThumbnail } from "@/components/shared/course-art";
import { CourseStatusBadge } from "@/components/shared/course-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, GripVertical, Trash2, Eye, Save, Rocket, BookOpen, ImagePlus, Loader2, FileText, Upload, Link2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FormSkeleton, PageHeaderSkeleton } from "@/components/shared/loading-skeletons";

const MAX_THUMBNAIL_DIM = 800;
const THUMBNAIL_JPEG_QUALITY = 0.82;
const MAX_SUBTITLE_LENGTH = 240;
const MAX_TITLE_LENGTH = 100;


function readImageFile(file: File, maxDim = MAX_THUMBNAIL_DIM, quality = THUMBNAIL_JPEG_QUALITY): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.onload = () => {
      const img = new window.Image(); // explicit window.Image avoids any ambiguity
      img.onerror = () => reject(new Error("That file isn't a valid image"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Image processing isn't supported in this browser"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Editor-local lesson-type union (lowercase, matches this UI's <Select>
// values) — kept separate from the API's uppercase LessonType enum, mapped
// at the save() boundary via TYPE_TO_API/TYPE_FROM_API below.
type BuilderLessonType = "video" | "quiz" | "article";

interface BLesson {
  id: string;           // server id, or local temp id for new lessons
  isNew: boolean;
  title: string;
  preview: boolean;
  hasVideo: boolean;
  cfVideoUid: string | null; // set locally after a fresh upload this session
  articleContent: string;
  resources: LessonResourceDto[];
  durationSec: number;
  type: BuilderLessonType;
  quiz?: BuilderQuiz;
  quizDirty?: boolean;  // quiz content changed since load
}
interface BSection { id: string; isNew: boolean; title: string; lessons: BLesson[] }

const lessonTypes: { value: BuilderLessonType; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "quiz", label: "Quiz" },
  { value: "article", label: "Article" },
];

const LEVEL_TO_API = {
  "Beginner": "BEGINNER",
  "Intermediate": "INTERMEDIATE",
  "Advanced": "ADVANCED",
  "All Levels": "ALL_LEVELS",
} as const;
const LEVEL_FROM_API: Record<string, keyof typeof LEVEL_TO_API> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  ALL_LEVELS: "All Levels",
};
const TYPE_TO_API = { video: "VIDEO", quiz: "QUIZ", article: "ARTICLE" } as const;
const TYPE_FROM_API: Record<string, BuilderLessonType> = {
  VIDEO: "video",
  QUIZ: "quiz",
  ARTICLE: "article",
};

let uid = 1000;
const nid = (p: string) => `new_${p}${uid++}`;
const isTemp = (id: string) => id.startsWith("new_");

const thumbSeeds = [
  "react", "ml", "design", "aws", "growth", "python", "system", "typescript",
  "speaking", "social", "finance", "mindfulness", "language",
];

function sectionsFromDetail(detail: CourseDetailDto): BSection[] {
  return detail.sections.map((s) => ({
    id: s.id,
    isNew: false,
    title: s.title,
    lessons: s.lessons.map((l) => ({
      id: l.id,
      isNew: false,
      title: l.title,
      preview: !!l.preview,
      hasVideo: l.hasVideo,
      cfVideoUid: null,
      articleContent: l.articleContent ?? "",
      resources: l.resources ?? [],
      durationSec: l.durationSec,
      type: TYPE_FROM_API[l.type] ?? "video",
      quiz: undefined, // loaded lazily for quiz lessons
    })),
  }));
}

export function CourseBuilder({
  courseId,
  mode = "admin",
}: {
  courseId?: string;
  mode?: "admin" | "instructor";
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const backHref = mode === "instructor" ? "/instructor/courses" : "/admin/courses";

  const { data: detail, isLoading } = useQuery({
    queryKey: ["authoring", "course", courseId],
    queryFn: () => authoringApi.course(courseId!),
    enabled: !!courseId,
    // The editor owns its local draft after the initial load. A background
    // refetch must not replace an in-progress curriculum with an older
    // server snapshot while the author is editing.
    refetchOnWindowFocus: false,
  });
  const { data: categories = [] } = useCategories();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState<keyof typeof LEVEL_TO_API>("Beginner");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("49.99");
  const [thumbnail, setThumbnail] = useState("react");
  const [thumbDrag, setThumbDrag] = useState(false);
  const [thumbError, setThumbError] = useState("");
  const thumbInputRef = useRef<HTMLInputElement>(null);
  // Categories load async; fall back to the first once they arrive.
  const categoryValue = category || categories[0] || "";
  const titleTooLong = title.length > MAX_TITLE_LENGTH;
  const subtitleTooLong = subtitle.length > MAX_SUBTITLE_LENGTH;
  const descriptionTooLong = description.length > MAX_COURSE_DESCRIPTION_LENGTH;
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragSection, setDragSection] = useState<number | null>(null);
  const [sections, setSections] = useState<BSection[]>([
    { id: nid("s"), isNew: true, title: "Section 1: Introduction", lessons: [{ id: nid("l"), isNew: true, title: "Welcome & overview", preview: true, hasVideo: false, cfVideoUid: null, articleContent: "", resources: [], durationSec: 300, type: "video" }] },
  ]);
  // Snapshot of server ids at load time, to compute deletions on save.
  const loadedIds = useRef<{ courseId: string | null; sections: Set<string>; lessons: Set<string> }>({
    courseId: null,
    sections: new Set(),
    lessons: new Set(),
  });

  // Seed form state when editing an existing course — adjusting state during
  // render instead of syncing in an effect.
  const [seededCourseId, setSeededCourseId] = useState<string | null>(null);
  if (detail && detail.id !== seededCourseId) {
    setSeededCourseId(detail.id);
    setTitle(detail.title);
    setSubtitle(detail.subtitle);
    setCategory(detail.category);
    setLevel(LEVEL_FROM_API[detail.level] ?? "Beginner");
    setDescription(detail.description);
    setPrice((detail.basePriceCents / 100).toFixed(2));
    setThumbnail(detail.thumbnail || "react");
    setPublished(detail.status === "PUBLISHED");
    setSections(sectionsFromDetail(detail));
  }

  useEffect(() => {
    if (!detail) return;
    if (loadedIds.current.courseId === detail.id) return;
    const secs = sectionsFromDetail(detail);
    loadedIds.current = {
      courseId: detail.id,
      sections: new Set(secs.map((s) => s.id)),
      lessons: new Set(secs.flatMap((s) => s.lessons.map((l) => l.id))),
    };
    // Pull quiz content for existing quiz lessons so the editor shows it.
    for (const s of detail.sections) {
      for (const l of s.lessons) {
        if (l.type === "QUIZ" || l.hasQuiz) {
          void authoringApi.quiz(l.id).then((qz) => {
            if (!qz) return;
            setSections((prev) =>
              prev.map((ps) => ({
                ...ps,
                lessons: ps.lessons.map((pl) =>
                  pl.id === l.id
                    ? {
                        ...pl,
                        quiz: {
                          passScore: qz.passScore,
                          questions: qz.questions.map((q) => ({
                            id: q.id,
                            prompt: q.prompt,
                            explanation: q.explanation ?? undefined,
                            options: q.options.map((o) => ({ id: o.id, text: o.text })),
                            correctOptionId: q.options.find((o) => o.isCorrect)?.id ?? "",
                          })),
                        },
                      }
                    : pl,
                ),
              })),
            );
          });
        }
      }
    }
  }, [detail]);

  const totalLessons = sections.reduce((a, s) => a + s.lessons.length, 0);

  /** Drops the dragged section at `to`, keeping the rest in order. */
  function moveSection(to: number) {
    setSections((list) => {
      if (dragSection === null || dragSection === to) return list;
      const next = [...list];
      const [moved] = next.splice(dragSection, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragSection(null);
  }

  function addSection() {
    setSections((s) => [...s, { id: nid("s"), isNew: true, title: `Section ${s.length + 1}`, lessons: [] }]);
  }
  function patchSection(id: string, p: Partial<BSection>) {
    setSections((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  function removeSection(id: string) {
    setSections((s) => s.filter((x) => x.id !== id));
  }
  function addLesson(sid: string) {
    setSections((s) => s.map((x) => (x.id === sid ? { ...x, lessons: [...x.lessons, { id: nid("l"), isNew: true, title: "New lesson", preview: false, hasVideo: false, cfVideoUid: null, articleContent: "", resources: [], durationSec: 300, type: "video" as const }] } : x)));
  }
  function patchLesson(sid: string, lid: string, p: Partial<BLesson>) {
    setSections((s) => s.map((x) => (x.id === sid ? { ...x, lessons: x.lessons.map((l) => (l.id === lid ? { ...l, ...p } : l)) } : x)));
  }
  function setLessonType(sid: string, lid: string, type: BuilderLessonType) {
    patchLesson(sid, lid, { type, quiz: type === "quiz" ? emptyQuiz() : undefined, quizDirty: type === "quiz" });
  }
  function removeLesson(sid: string, lid: string) {
    setSections((s) => s.map((x) => (x.id === sid ? { ...x, lessons: x.lessons.filter((l) => l.id !== lid) } : x)));
  }

  async function handleThumbnailFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setThumbError("Please upload an image file (PNG or JPG).");
      return;
    }
    try {
      setThumbError("");
      setThumbnail(await readImageFile(file));
    } catch (err) {
      setThumbError(err instanceof Error ? err.message : "Couldn't process that image");
    }
  }

  /** Persist everything through the authoring API, then apply the status action. */
  async function save(action: "draft" | "publish" | "review") {
    if (!title.trim()) {
      toast.error("Give your course a title first.");
      return;
    }
    if (titleTooLong) {
      toast.error(`Title cannot exceed ${MAX_TITLE_LENGTH} characters`);
      return;
    }
    if (subtitleTooLong) {
      toast.error("Subtitle cannot exceed 240 characters");
      return;
    }
    if (descriptionTooLong) {
      toast.error(`Description cannot exceed ${MAX_COURSE_DESCRIPTION_LENGTH} characters`);
      return;
    }
    setSaving(true);
    try {
      const fields = {
        title: title.trim(),
        subtitle,
        description,
        category: categoryValue,
        level: LEVEL_TO_API[level],
        thumbnail,
        basePriceCents: Math.max(0, Math.round((Number(price) || 0) * 100)),
      };
      const saved = courseId
        ? await authoringApi.updateCourse(courseId, fields)
        : await authoringApi.createCourse(fields);
      const id = saved.id;

      // Deletions first (anything loaded from the server but no longer present).
      const keptSections = new Set(sections.map((s) => s.id));
      const keptLessons = new Set(sections.flatMap((s) => s.lessons.map((l) => l.id)));
      for (const sid of loadedIds.current.sections) {
        if (!keptSections.has(sid)) await authoringApi.deleteSection(sid);
      }
      for (const lid of loadedIds.current.lessons) {
        if (keptLessons.has(lid)) continue;
        try {
          await authoringApi.deleteLesson(lid);
        } catch {
          /* already gone via section-delete cascade */
        }
      }

      // Upsert sections and lessons in display order.
      const lessonServerIds = new Map<string, string>(); // builder id -> server id
      for (const [si, s] of sections.entries()) {
        let sectionServerId = s.id;
        if (isTemp(s.id)) {
          const before = new Set(
            (await authoringApi.course(id)).sections.map((x) => x.id),
          );
          const after = await authoringApi.addSection(id, { title: s.title, order: si });
          sectionServerId =
            after.sections.find((x) => !before.has(x.id))?.id ?? s.id;
        } else {
          await authoringApi.updateSection(s.id, { title: s.title, order: si });
        }

        for (const [li, l] of s.lessons.entries()) {
          const lessonBody = {
            title: l.title || "Untitled lesson",
            type: TYPE_TO_API[l.type],
            durationSec: l.durationSec,
            preview: l.preview,
            order: li,
            // Only sent when a fresh upload just happened — omitting it leaves
            // an already-attached video untouched (see authoring.service.ts).
            ...(l.cfVideoUid ? { cfVideoUid: l.cfVideoUid } : {}),
            ...(l.type === "article" ? { articleContent: l.articleContent } : {}),
            // Only complete rows are sent; the API rejects a resource without a URL.
            resources: l.resources.filter((r) => r.name.trim() && r.url.trim()),
          };
          let lessonServerId = l.id;
          if (isTemp(l.id)) {
            const before = new Set(
              (await authoringApi.course(id)).sections
                .flatMap((x) => x.lessons)
                .map((x) => x.id),
            );
            const after = await authoringApi.addLesson(sectionServerId, lessonBody);
            lessonServerId =
              after.sections
                .flatMap((x) => x.lessons)
                .find((x) => !before.has(x.id))?.id ?? l.id;
          } else {
            await authoringApi.updateLesson(l.id, lessonBody);
          }
          lessonServerIds.set(l.id, lessonServerId);

          // Sync quiz content for quiz lessons (replace-all strategy).
          if (l.type === "quiz" && l.quiz && (l.quizDirty || isTemp(l.id))) {
            const quiz = await authoringApi.upsertQuiz(lessonServerId, l.quiz.passScore);
            for (const q of quiz.questions) {
              await authoringApi.deleteQuizQuestion(q.id);
            }
            for (const [qi, q] of l.quiz.questions.entries()) {
              const options = q.options
                .filter((o) => o.text.trim())
                .map((o, oi) => ({
                  text: o.text,
                  isCorrect: o.id === q.correctOptionId,
                  order: oi,
                }));
              if (!q.prompt.trim() || options.length < 2) continue;
              await authoringApi.addQuizQuestion(quiz.id, {
                prompt: q.prompt,
                explanation: q.explanation || undefined,
                order: qi,
                options,
              });
            }
          }
        }
      }

      // Status transition.
      const targetStatus =
        action === "publish" ? "PUBLISHED" : action === "review" ? "REVIEW" : "DRAFT";
      if (saved.status !== targetStatus) {
        await authoringApi.setCourseStatus(id, targetStatus);
      }

      void qc.invalidateQueries({ queryKey: ["authoring", "course", id] });
      void qc.invalidateQueries({ queryKey: ["instructor", "courses"] });
      void qc.invalidateQueries({ queryKey: ["admin"] });

      const msg =
        action === "publish"
          ? "Course published! 🚀"
          : action === "review"
          ? "Submitted for review 📩"
          : "Draft saved";
      toast.success(msg, {
        description:
          action === "review"
            ? "Our team will review and publish it shortly."
            : title || "Untitled course",
      });
      setTimeout(() => router.push(backHref), 700);
    } catch (err) {
      const message = getApiErrorMessage(err);
      const lowerMessage = message.toLowerCase();
      const friendlyMessage =
        lowerMessage.includes("subtitle") && message.includes("240")
          ? "Subtitle cannot exceed 240 characters"
          : lowerMessage.includes("description") && message.includes(String(MAX_COURSE_DESCRIPTION_LENGTH))
            ? `Description cannot exceed ${MAX_COURSE_DESCRIPTION_LENGTH} characters`
            : message;
      toast.error(friendlyMessage);
    } finally {
      setSaving(false);
    }
  }

  if (courseId && isLoading) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <PageHeaderSkeleton action />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border p-6"><FormSkeleton fields={5} /></div>
          <div className="space-y-6"><div className="h-44 animate-pulse rounded-xl bg-muted" /><div className="h-52 animate-pulse rounded-xl bg-muted" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push(backHref)} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{courseId ? "Edit course" : "Create a course"}</h1>
            <p className="text-sm text-muted-foreground">{totalLessons} lessons · {sections.length} sections</p>
          </div>
        </div>
      </div>

      <div className="sticky top-[calc(3.5rem+0.75rem)] z-20 flex justify-end rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur md:top-4">
        <div className="flex flex-wrap justify-end gap-2">
          {mode === "instructor" ? (
            <>
              <Button variant="outline" onClick={() => save("draft")} disabled={saving}><Save /> Save draft</Button>
              <Button onClick={() => save("review")} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Rocket />} Submit for review
              </Button>
            </>
          ) : (
            <Button onClick={() => save(published ? "publish" : "draft")} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Details */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-primary" /> Course details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
             <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="course-subtitle">Title</Label>
                  <span className={titleTooLong ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
                    {title.length}/{MAX_TITLE_LENGTH}
                  </span>
                </div>
                <Input
                  id="course-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="One-line value proposition"
                  aria-invalid={titleTooLong}
                  aria-describedby={titleTooLong ? "course-title-error" : undefined}
                />
                {titleTooLong && (
                  <p id="course-title-error" className="text-xs font-medium text-destructive" role="alert">
                    Title cannot exceed {MAX_TITLE_LENGTH} characters
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="course-subtitle">Subtitle</Label>
                  <span className={subtitleTooLong ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
                    {subtitle.length}/{MAX_SUBTITLE_LENGTH}
                  </span>
                </div>
                <Input
                  id="course-subtitle"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="One-line value proposition"
                  aria-invalid={subtitleTooLong}
                  aria-describedby={subtitleTooLong ? "course-subtitle-error" : undefined}
                />
                {subtitleTooLong && (
                  <p id="course-subtitle-error" className="text-xs font-medium text-destructive" role="alert">
                    Subtitle cannot exceed 240 characters
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={categoryValue} onValueChange={(v) => v && setCategory(v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Level</Label>
                  <Select value={level} onValueChange={(v) => v && setLevel(v as keyof typeof LEVEL_TO_API)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(LEVEL_TO_API) as (keyof typeof LEVEL_TO_API)[]).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="course-description">Description</Label>
                  <span className={descriptionTooLong ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
                    {description.length}/{MAX_COURSE_DESCRIPTION_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="course-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will students learn?"
                  className="min-h-28"
                  aria-invalid={descriptionTooLong}
                  aria-describedby={descriptionTooLong ? "course-description-error" : undefined}
                />
                {descriptionTooLong && (
                  <p id="course-description-error" className="text-xs font-medium text-destructive" role="alert">
                    Description cannot exceed {MAX_COURSE_DESCRIPTION_LENGTH} characters
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Curriculum builder */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Curriculum</CardTitle>
              <Button size="sm" variant="outline" onClick={addSection}><Plus /> Add section</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {sections.map((s, si) => (
                <div
                  key={s.id}
                  className={cn(
                    "rounded-xl border bg-muted/20 p-3",
                    dragSection === si && "opacity-50",
                  )}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => moveSection(si)}
                >
                  <div className="flex items-center gap-2">
                    {/* The grip was decorative; native DnD reorders the list and
                        the save loop writes the new `order` on each section. */}
                    <span
                      draggable
                      onDragStart={() => setDragSection(si)}
                      onDragEnd={() => setDragSection(null)}
                      role="button"
                      tabIndex={0}
                      aria-label="Drag to reorder section"
                      className="shrink-0 cursor-grab"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <Input value={s.title} onChange={(e) => patchSection(s.id, { title: e.target.value })} className="h-8 font-medium" />
                    <Button size="icon-sm" variant="ghost" onClick={() => removeSection(s.id)} aria-label="Remove section"><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                  </div>

                  <div className="mt-3 space-y-3 pl-6">
                    {s.lessons.map((l) => (
                      <div key={l.id} className="rounded-lg border bg-card p-3">
                        <div className="flex items-center gap-2">
                          <Input value={l.title} onChange={(e) => patchLesson(s.id, l.id, { title: e.target.value })} className="h-8" placeholder="Lesson title" />
                          <Select value={l.type} onValueChange={(v) => v && setLessonType(s.id, l.id, v as BuilderLessonType)}>
                            <SelectTrigger className="h-8 w-28 shrink-0"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {lessonTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                            <Eye className="h-3.5 w-3.5" /> Preview
                            <Switch size="sm" checked={l.preview} onCheckedChange={() => patchLesson(s.id, l.id, { preview: !l.preview })} />
                          </label>
                          <Button size="icon-sm" variant="ghost" onClick={() => removeLesson(s.id, l.id)} aria-label="Remove lesson"><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                        </div>
                        <div className="mt-2">
                          {l.type === "quiz" ? (
                            <QuizEditor
                              quiz={l.quiz ?? emptyQuiz()}
                              onChange={(quiz) => patchLesson(s.id, l.id, { quiz, quizDirty: true })}
                            />
                          ) : l.type === "video" ? (
                            <VideoUpload
                              compact
                              initiallyUploaded={l.hasVideo}
                              onReady={(uid) => patchLesson(s.id, l.id, { cfVideoUid: uid, hasVideo: true })}
                            />
                          ) : (
                            <Textarea
                              value={l.articleContent}
                              onChange={(e) => patchLesson(s.id, l.id, { articleContent: e.target.value })}
                              placeholder="Write the article content students will read for this lesson…"
                              className="min-h-32 text-sm"
                            />
                          )}
                        </div>
                        <LessonResources
                          lessonId={l.id}
                          isNew={isTemp(l.id)}
                          resources={l.resources}
                          onChange={(resources) => patchLesson(s.id, l.id, { resources })}
                        />
                      </div>
                    ))}
                    <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => addLesson(s.id)}><Plus /> Add lesson</Button>
                  </div>
                </div>
              ))}
              {sections.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No sections yet. Add your first section to get started.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {mode === "instructor" ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Review status</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Current</div>
                  <CourseStatusBadge status={detail?.status ?? "DRAFT"} />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Save a draft any time. When you&apos;re ready, <span className="font-medium text-foreground">Submit for review</span> — our team approves new courses before they go live to keep quality high.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-base">Publish</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Status</div>
                    <div className="text-xs text-muted-foreground">{published ? "Visible to students" : "Hidden — draft"}</div>
                  </div>
                  <Badge variant="outline" className={published ? "text-success" : "text-muted-foreground"}>{published ? "Published" : "Draft"}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pub">Publish course</Label>
                  <Switch id="pub" checked={published} onCheckedChange={setPublished} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Label>Base price (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} className="pl-7" inputMode="decimal" />
              </div>
              <p className="text-xs text-muted-foreground">Regional & per-country pricing is applied automatically from your Pricing rules.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Course thumbnail</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <CourseArt seed={thumbnail} title={title || "Course title"} category={categoryValue} className="h-32 rounded-lg" />

              <input
                ref={thumbInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleThumbnailFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => thumbInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setThumbDrag(true); }}
                onDragLeave={() => setThumbDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setThumbDrag(false);
                  handleThumbnailFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center transition-colors",
                  thumbDrag ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/40",
                )}
              >
                <ImagePlus className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Drag & drop an image, or click to upload</span>
                <span className="text-[11px] text-muted-foreground">PNG or JPG · recommended 1280×720</span>
              </button>
              {thumbError && <p className="text-xs text-destructive">{thumbError}</p>}
              {isImageThumbnail(thumbnail) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setThumbnail(thumbSeeds[0])}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove image
                </Button>
              )}

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Or pick a color theme</p>
                <div className="flex flex-wrap gap-1.5">
                  {thumbSeeds.map((t) => (
                    <button key={t} type="button" onClick={() => setThumbnail(t)} className={`h-7 w-7 rounded-md border-2 ${thumbnail === t ? "border-primary" : "border-transparent"}`}>
                      <CourseArt seed={t} title="" className="h-full w-full rounded" iconSize={12} />
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Kept in sync with apps/api/src/modules/storage/storage.constants.ts. Client
// pre-check is a UX nicety — the API enforces the same list on upload.
const RESOURCE_ACCEPT_EXTENSIONS = [
  ".pdf", ".zip",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
  ".txt", ".csv", ".mp3",
] as const;
const RESOURCE_MAX_BYTES = 10 * 1024 * 1024;
const RESOURCE_LIMIT = 20;

/**
 * Lesson attachments. Two modes on the same list:
 *  - Link: instructor pastes a URL they own (no `storageKey`).
 *  - Upload: platform hosts the file (has `storageKey`) — read-only once
 *    uploaded, remove calls the server so we don't leak the bucket object.
 * Uploads require a saved lesson (needs a lessonId to POST to).
 */
function LessonResources({
  lessonId,
  isNew,
  resources,
  onChange,
}: {
  lessonId: string;
  isNew: boolean;
  resources: LessonResourceDto[];
  onChange: (next: LessonResourceDto[]) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const patch = (i: number, fields: Partial<LessonResourceDto>) =>
    onChange(resources.map((r, x) => (x === i ? { ...r, ...fields } : r)));

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    if (resources.length >= RESOURCE_LIMIT) {
      toast.error(`Max ${RESOURCE_LIMIT} resources per lesson.`);
      return;
    }
    if (file.size > RESOURCE_MAX_BYTES) {
      toast.error(`File exceeds 10 MB (${formatBytes(file.size)}).`);
      return;
    }
    const ext = ("." + (file.name.split(".").pop() ?? "")).toLowerCase();
    if (!RESOURCE_ACCEPT_EXTENSIONS.includes(ext as (typeof RESOURCE_ACCEPT_EXTENSIONS)[number])) {
      toast.error(`Unsupported file type: ${ext || "unknown"}`);
      return;
    }
    setUploading(true);
    try {
      const uploaded = await authoringApi.uploadLessonResource(lessonId, file);
      onChange([...resources, uploaded]);
      toast.success(`Uploaded ${uploaded.name}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleRemove(i: number) {
    const r = resources[i];
    if (r.storageKey) {
      try {
        await authoringApi.deleteLessonResource(lessonId, r.storageKey);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
        return;
      }
    }
    onChange(resources.filter((_, x) => x !== i));
  }

  const canUpload = !isNew && !uploading && resources.length < RESOURCE_LIMIT;

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <FileText className="h-3.5 w-3.5" /> Downloadable resources
        <span className="ml-auto text-[11px] font-normal">
          {resources.length}/{RESOURCE_LIMIT}
        </span>
      </div>

      {resources.map((r, i) =>
        r.storageKey ? (
          // Uploaded file — filename + size are frozen at upload time.
          <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
            <Upload className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 truncate text-sm hover:underline"
              title={r.name}
            >
              {r.name}
            </a>
            {r.sizeLabel && (
              <span className="shrink-0 text-xs text-muted-foreground">{r.sizeLabel}</span>
            )}
            <a href={r.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Open resource">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remove resource"
              onClick={() => handleRemove(i)}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <div key={i} className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              value={r.name}
              onChange={(e) => patch(i, { name: e.target.value })}
              placeholder="Name (e.g. Starter files)"
              className="h-8 flex-1 min-w-0"
            />
            <Input
              value={r.url}
              onChange={(e) => patch(i, { url: e.target.value })}
              placeholder="https://…"
              type="url"
              className="h-8 flex-[2] min-w-0"
            />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remove resource"
              onClick={() => handleRemove(i)}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ),
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={RESOURCE_ACCEPT_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() => fileInput.current?.click()}
          disabled={!canUpload}
          title={isNew ? "Save the lesson to attach files" : undefined}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload file
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-muted-foreground"
          onClick={() => onChange([...resources, { name: "", url: "" }])}
          disabled={resources.length >= RESOURCE_LIMIT}
        >
          <Plus /> Add link
        </Button>
        {isNew && (
          <span className="text-[11px] text-muted-foreground">
            Save the lesson first to attach files.
          </span>
        )}
      </div>
    </div>
  );
}
