"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CourseDetailDto } from "@skillstream/shared";
import type { Lesson, Quiz } from "@/types";
import { categories } from "@/lib/mock/courses";
import { authoringApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { VideoUpload } from "@/components/admin/video-upload";
import { QuizEditor, emptyQuiz } from "@/components/admin/quiz-editor";
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
  ArrowLeft, Plus, GripVertical, Trash2, Eye, Save, Rocket, BookOpen, ImagePlus, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_THUMBNAIL_DIM = 800;
const THUMBNAIL_JPEG_QUALITY = 0.82;

function readImageFile(file: File, maxDim = MAX_THUMBNAIL_DIM, quality = THUMBNAIL_JPEG_QUALITY): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
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

interface BLesson {
  id: string;           // server id, or local temp id for new lessons
  isNew: boolean;
  title: string;
  preview: boolean;
  hasVideo: boolean;
  cfVideoUid: string | null; // set locally after a fresh upload this session
  articleContent: string;
  durationSec: number;
  type: Lesson["type"];
  quiz?: Quiz;
  quizDirty?: boolean;  // quiz content changed since load
}
interface BSection { id: string; isNew: boolean; title: string; lessons: BLesson[] }

const lessonTypes: { value: Lesson["type"]; label: string }[] = [
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
const TYPE_FROM_API: Record<string, Lesson["type"]> = {
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
  });

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [level, setLevel] = useState<keyof typeof LEVEL_TO_API>("Beginner");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("49.99");
  const [thumbnail, setThumbnail] = useState("react");
  const [thumbDrag, setThumbDrag] = useState(false);
  const [thumbError, setThumbError] = useState("");
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<BSection[]>([
    { id: nid("s"), isNew: true, title: "Section 1: Introduction", lessons: [{ id: nid("l"), isNew: true, title: "Welcome & overview", preview: true, hasVideo: false, cfVideoUid: null, articleContent: "", durationSec: 300, type: "video" }] },
  ]);
  // Snapshot of server ids at load time, to compute deletions on save.
  const loadedIds = useRef<{ sections: Set<string>; lessons: Set<string> }>({
    sections: new Set(),
    lessons: new Set(),
  });

  // Seed form state when editing an existing course.
  useEffect(() => {
    if (!detail) return;
    setTitle(detail.title);
    setSubtitle(detail.subtitle);
    setCategory(detail.category);
    setLevel(LEVEL_FROM_API[detail.level] ?? "Beginner");
    setDescription(detail.description);
    setPrice((detail.basePriceCents / 100).toFixed(2));
    setThumbnail(detail.thumbnail || "react");
    setPublished(detail.status === "PUBLISHED");
    const secs = sectionsFromDetail(detail);
    setSections(secs);
    loadedIds.current = {
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
    setSections((s) => s.map((x) => (x.id === sid ? { ...x, lessons: [...x.lessons, { id: nid("l"), isNew: true, title: "New lesson", preview: false, hasVideo: false, cfVideoUid: null, articleContent: "", durationSec: 300, type: "video" as const }] } : x)));
  }
  function patchLesson(sid: string, lid: string, p: Partial<BLesson>) {
    setSections((s) => s.map((x) => (x.id === sid ? { ...x, lessons: x.lessons.map((l) => (l.id === lid ? { ...l, ...p } : l)) } : x)));
  }
  function setLessonType(sid: string, lid: string, type: Lesson["type"]) {
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
    setSaving(true);
    try {
      const fields = {
        title: title.trim(),
        subtitle,
        description,
        category,
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
      toast.error(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (courseId && isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push(backHref)} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{courseId ? "Edit course" : "Create a course"}</h1>
            <p className="text-sm text-muted-foreground">{totalLessons} lessons · {sections.length} sections</p>
          </div>
        </div>
        <div className="flex gap-2">
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
              <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Modern React Masterclass" /></div>
              <div className="space-y-1.5"><Label>Subtitle</Label><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="One-line value proposition" /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => v && setCategory(v)}>
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
              <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will students learn?" className="min-h-28" /></div>
            </CardContent>
          </Card>

          {/* Curriculum builder */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Curriculum</CardTitle>
              <Button size="sm" variant="outline" onClick={addSection}><Plus /> Add section</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {sections.map((s) => (
                <div key={s.id} className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                    <Input value={s.title} onChange={(e) => patchSection(s.id, { title: e.target.value })} className="h-8 font-medium" />
                    <Button size="icon-sm" variant="ghost" onClick={() => removeSection(s.id)} aria-label="Remove section"><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                  </div>

                  <div className="mt-3 space-y-3 pl-6">
                    {s.lessons.map((l) => (
                      <div key={l.id} className="rounded-lg border bg-card p-3">
                        <div className="flex items-center gap-2">
                          <Input value={l.title} onChange={(e) => patchLesson(s.id, l.id, { title: e.target.value })} className="h-8" placeholder="Lesson title" />
                          <Select value={l.type} onValueChange={(v) => v && setLessonType(s.id, l.id, v as Lesson["type"])}>
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
                  <CourseStatusBadge status={detail ? (detail.status.toLowerCase() as "draft" | "review" | "published") : "draft"} />
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
              <CourseArt seed={thumbnail} title={title || "Course title"} category={category} className="h-32 rounded-lg" />

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
