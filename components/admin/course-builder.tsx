"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Course, Lesson, Quiz } from "@/types";
import { categories } from "@/lib/mock/courses";
import { useStore } from "@/lib/context/store";
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
  ArrowLeft, Plus, GripVertical, Trash2, Eye, Save, Rocket, BookOpen, Video, ImagePlus,
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
  id: string;
  title: string;
  preview: boolean;
  hasVideo: boolean;
  type: Lesson["type"];
  quiz?: Quiz;
}
interface BSection { id: string; title: string; lessons: BLesson[] }

const lessonTypes: { value: Lesson["type"]; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "quiz", label: "Quiz" },
  { value: "article", label: "Article" },
];

let uid = 1000;
const nid = (p: string) => `${p}${uid++}`;

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const thumbSeeds = [
  "react", "ml", "design", "aws", "growth", "python", "system", "typescript",
  "speaking", "social", "finance", "mindfulness", "language",
];

export function CourseBuilder({
  course,
  mode = "admin",
  instructorId,
}: {
  course?: Course;
  mode?: "admin" | "instructor";
  instructorId?: string;
}) {
  const router = useRouter();
  const { upsertCourse } = useStore();
  const backHref = mode === "instructor" ? "/instructor/courses" : "/admin/courses";
  const [title, setTitle] = useState(course?.title ?? "");
  const [subtitle, setSubtitle] = useState(course?.subtitle ?? "");
  const [category, setCategory] = useState(course?.category ?? categories[0]);
  const [level, setLevel] = useState(course?.level ?? "Beginner");
  const [description, setDescription] = useState(course?.description ?? "");
  const [price, setPrice] = useState(String(course?.basePrice ?? 49.99));
  const [thumbnail, setThumbnail] = useState(course?.thumbnail ?? "react");
  const [thumbDrag, setThumbDrag] = useState(false);
  const [thumbError, setThumbError] = useState("");
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const [published, setPublished] = useState(course?.status === "published");
  const [sections, setSections] = useState<BSection[]>(
    course
      ? course.sections.map((s) => ({
          id: s.id,
          title: s.title,
          lessons: s.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            preview: !!l.preview,
            hasVideo: l.type === "video",
            type: l.type,
            quiz: l.quiz,
          })),
        }))
      : [{ id: nid("s"), title: "Section 1: Introduction", lessons: [{ id: nid("l"), title: "Welcome & overview", preview: true, hasVideo: false, type: "video" }] }],
  );

  const totalLessons = sections.reduce((a, s) => a + s.lessons.length, 0);

  function addSection() {
    setSections((s) => [...s, { id: nid("s"), title: `Section ${s.length + 1}`, lessons: [] }]);
  }
  function patchSection(id: string, p: Partial<BSection>) {
    setSections((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  function removeSection(id: string) {
    setSections((s) => s.filter((x) => x.id !== id));
  }
  function addLesson(sid: string) {
    setSections((s) => s.map((x) => (x.id === sid ? { ...x, lessons: [...x.lessons, { id: nid("l"), title: "New lesson", preview: false, hasVideo: false, type: "video" }] } : x)));
  }
  function patchLesson(sid: string, lid: string, p: Partial<BLesson>) {
    setSections((s) => s.map((x) => (x.id === sid ? { ...x, lessons: x.lessons.map((l) => (l.id === lid ? { ...l, ...p } : l)) } : x)));
  }
  function setLessonType(sid: string, lid: string, type: Lesson["type"]) {
    patchLesson(sid, lid, { type, quiz: type === "quiz" ? emptyQuiz() : undefined });
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

  function originalDurationSec(lessonId: string) {
    for (const s of course?.sections ?? []) {
      const l = s.lessons.find((x) => x.id === lessonId);
      if (l) return l.durationSec;
    }
    return 300;
  }

  function save(action: "draft" | "publish" | "review") {
    const id = course?.id ?? nid("c_");
    const status: Course["status"] =
      action === "publish" ? "published" : action === "review" ? "review" : "draft";
    const newCourse: Course = {
      id,
      slug: course?.slug ?? (slugify(title) || id),
      title: title || "Untitled course",
      subtitle,
      description,
      category,
      level: level as Course["level"],
      thumbnail,
      instructorId: course?.instructorId ?? instructorId ?? "ins_sara",
      basePrice: Number(price) || 0,
      originalPrice: course?.originalPrice,
      rating: course?.rating ?? 0,
      reviewCount: course?.reviewCount ?? 0,
      studentCount: course?.studentCount ?? 0,
      language: course?.language ?? "English",
      updatedAt: new Date().toISOString(),
      status,
      bestseller: course?.bestseller,
      whatYouLearn: course?.whatYouLearn ?? [],
      requirements: course?.requirements ?? [],
      sections: sections.map((s) => ({
        id: s.id,
        title: s.title,
        lessons: s.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          durationSec: originalDurationSec(l.id),
          type: l.type,
          preview: l.preview,
          quiz: l.quiz,
        })),
      })),
      revenue: course?.revenue ?? 0,
    };
    upsertCourse(newCourse);
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
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push(backHref)} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{course ? "Edit course" : "Create a course"}</h1>
            <p className="text-sm text-muted-foreground">{totalLessons} lessons · {sections.length} sections</p>
          </div>
        </div>
        <div className="flex gap-2">
          {mode === "instructor" ? (
            <>
              <Button variant="outline" onClick={() => save("draft")}><Save /> Save draft</Button>
              <Button onClick={() => save("review")}><Rocket /> Submit for review</Button>
            </>
          ) : (
            <Button onClick={() => save(published ? "publish" : "draft")}><Save /> Save</Button>
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
                  <Select value={level} onValueChange={(v) => setLevel(v as Course["level"])}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Beginner", "Intermediate", "Advanced", "All Levels"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will students learn?" className="min-h-28" /></div>
            </CardContent>
          </Card>

          {/* Promo video */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Video className="h-4 w-4 text-primary" /> Promo video</CardTitle></CardHeader>
            <CardContent><VideoUpload /></CardContent>
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
                            <QuizEditor quiz={l.quiz ?? emptyQuiz()} onChange={(quiz) => patchLesson(s.id, l.id, { quiz })} />
                          ) : l.type === "video" ? (
                            <VideoUpload compact initialReady={l.hasVideo} onReady={() => patchLesson(s.id, l.id, { hasVideo: true })} />
                          ) : (
                            <p className="text-xs text-muted-foreground">Article lessons use the description above — no media upload needed.</p>
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
                  <CourseStatusBadge status={course?.status} />
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
