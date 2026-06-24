"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Course, Lesson, Quiz } from "@/types";
import { categories } from "@/lib/mock/courses";
import { VideoUpload } from "@/components/admin/video-upload";
import { QuizEditor, emptyQuiz } from "@/components/admin/quiz-editor";
import { CourseArt } from "@/components/shared/course-art";
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
  ArrowLeft, Plus, GripVertical, Trash2, Eye, Save, Rocket, BookOpen, Video,
} from "lucide-react";
import { toast } from "sonner";

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

const thumbSeeds = [
  "react", "ml", "design", "aws", "growth", "python", "system", "typescript",
  "speaking", "social", "finance", "mindfulness", "language",
];

export function CourseBuilder({ course }: { course?: Course }) {
  const router = useRouter();
  const [title, setTitle] = useState(course?.title ?? "");
  const [subtitle, setSubtitle] = useState(course?.subtitle ?? "");
  const [category, setCategory] = useState(course?.category ?? categories[0]);
  const [level, setLevel] = useState(course?.level ?? "Beginner");
  const [description, setDescription] = useState(course?.description ?? "");
  const [price, setPrice] = useState(String(course?.basePrice ?? 49.99));
  const [seed, setSeed] = useState(course?.thumbnail ?? "react");
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

  function save(publish: boolean) {
    toast.success(publish ? "Course published! 🚀" : "Draft saved", {
      description: title || "Untitled course",
    });
    setTimeout(() => router.push("/admin/courses"), 700);
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/courses")} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{course ? "Edit course" : "Create a course"}</h1>
            <p className="text-sm text-muted-foreground">{totalLessons} lessons · {sections.length} sections</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save(false)}><Save /> Save draft</Button>
          <Button onClick={() => save(true)}><Rocket /> Publish</Button>
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
              {sections.map((s, si) => (
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
              <CourseArt seed={seed} title={title || "Course title"} category={category} className="h-32 rounded-lg" />
              <div className="flex flex-wrap gap-1.5">
                {thumbSeeds.map((t) => (
                  <button key={t} onClick={() => setSeed(t)} className={`h-7 w-7 rounded-md border-2 ${seed === t ? "border-primary" : "border-transparent"}`}>
                    <CourseArt seed={t} title="" className="h-full w-full rounded" iconSize={12} />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
