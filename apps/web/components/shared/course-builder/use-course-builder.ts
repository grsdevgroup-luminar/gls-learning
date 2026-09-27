"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ISO_STANDARD_OPTIONS, MAX_COURSE_DESCRIPTION_LENGTH } from "@skillstream/shared";
import { authoringApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { emptyQuiz } from "@/components/shared/quiz-editor";
import { toast } from "sonner";
import {
  articleDurationSec, isTemp, nid, quizDurationSec, readImageFile, sectionsFromDetail,
} from "./course-builder.utils";
import {
  LEVEL_FROM_API, LEVEL_TO_API, MAX_SUBTITLE_LENGTH, MAX_TITLE_LENGTH, TYPE_TO_API,
  type BLesson, type BSection, type BuilderLessonType,
} from "./course-builder.types";

export function useCourseBuilder({ courseId, mode }: { courseId?: string; mode: "admin" | "instructor" }) {  const router = useRouter();
  const qc = useQueryClient();
  const backHref =
    mode === "instructor" ? "/instructor/courses" : "/admin/courses";

  const { data: detail, isLoading } = useQuery({
    queryKey: ["authoring", "course", courseId],
    queryFn: () => authoringApi.course(courseId!),
    enabled: !!courseId,
    // The editor owns its local draft after the initial load. A background
    // refetch must not replace an in-progress curriculum with an older
    // server snapshot while the author is editing.
    refetchOnWindowFocus: false,
  });
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState("");
  const [isoStandard, setIsoStandard] = useState("");
  const [customIsoStandard, setCustomIsoStandard] = useState("");
  const [level, setLevel] = useState<keyof typeof LEVEL_TO_API>("Beginner");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [thumbnail, setThumbnail] = useState("course");
  const [thumbDrag, setThumbDrag] = useState(false);
  const [thumbError, setThumbError] = useState("");
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const categoryValue = category;
  const titleTooLong = title.length > MAX_TITLE_LENGTH;
  const subtitleTooLong = subtitle.length > MAX_SUBTITLE_LENGTH;
  const descriptionTooLong = description.length > MAX_COURSE_DESCRIPTION_LENGTH;
  const [published, setPublished] = useState(false);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<
    "draft" | "publish" | "review" | null
  >(null);
  const [dragSection, setDragSection] = useState<number | null>(null);
  // Collapsed-by-id, UI-only — not persisted. Sections start expanded.
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );
  function toggleSectionCollapsed(id: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const [sections, setSections] = useState<BSection[]>([
    {
      id: nid("s"),
      isNew: true,
      title: "Section 1: Introduction",
      lessons: [],
    },
  ]);
  // Snapshot of server ids at load time, to compute deletions on save.
  const loadedIds = useRef<{
    courseId: string | null;
    sections: Set<string>;
    lessons: Set<string>;
  }>({
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
    const savedIsoStandard = detail.isoStandard ?? "";
    const isPresetIsoStandard = (
      ISO_STANDARD_OPTIONS as readonly string[]
    ).includes(savedIsoStandard);
    setIsoStandard(
      isPresetIsoStandard || !savedIsoStandard ? savedIsoStandard : "OTHER",
    );
    setCustomIsoStandard(
      savedIsoStandard && !isPresetIsoStandard ? savedIsoStandard : "",
    );
    setLevel(LEVEL_FROM_API[detail.level] ?? "Beginner");
    setDescription(detail.description);
    setPrice((detail.basePriceCents / 100).toFixed(2));
    setThumbnail(detail.thumbnail || "course");
    setPublished(detail.status === "PUBLISHED");
    setVisibility(detail.visibility);
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
                          // No dedicated schema field for this yet — infer a
                          // starting per-question minute from the lesson's
                          // saved total so existing quizzes have a sane value
                          // to edit going forward.
                          minutesPerQuestion:
                            qz.questions.length > 0
                              ? Math.max(
                                  1,
                                  Math.round(
                                    l.durationSec / qz.questions.length / 60,
                                  ),
                                )
                              : 1,
                          questions: qz.questions.map((q) => ({
                            id: q.id,
                            prompt: q.prompt,
                            explanation: q.explanation ?? undefined,
                            options:
                              q.options?.map((o) => ({
                                id: o.id,
                                text: o.text,
                              })) ?? [],
                            correctOptionId:
                              q.options?.find((o) => o.isCorrect)?.id ?? "",
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

  const totalLessons = sections?.reduce((a, s) => a + s.lessons.length, 0) ?? 0;

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
    setSections((s) => [
      ...s,
      {
        id: nid("s"),
        isNew: true,
        title: `Section ${s.length + 1}`,
        lessons: [],
      },
    ]);
  }
  function patchSection(id: string, p: Partial<BSection>) {
    setSections((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  function removeSection(id: string) {
    setSections((s) => s.filter((x) => x.id !== id));
  }
  function addLesson(sid: string) {
    setSections((s) =>
      s.map((x) =>
        x.id === sid
          ? {
              ...x,
              lessons: [
                ...x.lessons,
                {
                  id: nid("l"),
                  isNew: true,
                  title: "New lesson",
                  preview: false,
                  hasVideo: false,
                  cfVideoUid: null,
                  uploadId: null,
                  replacingVideo: false,
                  videoLabel: null,
                  articleContent: "",
                  resources: [],
                  pendingResourceFiles: [],
                  pptxName: null,
                  hasServerPptx: false,
                  pptxDurationSec: 0,
                  pendingPptxFile: null,
                  removePptx: false,
                  durationSec: 0,
                  type: "video" as const,
                },
              ],
            }
          : x,
      ),
    );
  }
  function patchLesson(sid: string, lid: string, p: Partial<BLesson>) {
    setSections((s) =>
      s.map((x) =>
        x.id === sid
          ? {
              ...x,
              lessons: x.lessons.map((l) =>
                l.id === lid ? { ...l, ...p } : l,
              ),
            }
          : x,
      ),
    );
  }
  function setLessonType(sid: string, lid: string, type: BuilderLessonType) {
    const quiz = type === "quiz" ? emptyQuiz() : undefined;
    const durationSec =
      type === "quiz"
        ? quizDurationSec(quiz!)
        : type === "article"
          ? articleDurationSec("")
          : 0;
    patchLesson(sid, lid, {
      type,
      quiz,
      quizDirty: type === "quiz",
      durationSec,
    });
  }
  function removeLesson(sid: string, lid: string) {
    setSections((s) =>
      s.map((x) =>
        x.id === sid
          ? { ...x, lessons: x.lessons.filter((l) => l.id !== lid) }
          : x,
      ),
    );
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
      setThumbError(
        err instanceof Error ? err.message : "Couldn't process that image",
      );
    }
  }

  /** Persist everything through the authoring API, then apply the status action. */
  async function save(action: "draft" | "publish" | "review") {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if ((action === "publish" || action === "review") && totalLessons === 0) {
      toast.error("Add at least one lesson before submitting this course.");
      return;
    }
    if (action === "publish" || action === "review") {
      const incomplete = sections
        .flatMap((section) => section.lessons)
        .filter((lesson) => {
          const hasResource =
            lesson.resources.some(
              (resource) => resource.name.trim() && resource.url.trim(),
            ) || lesson.pendingResourceFiles.length > 0;
          if (lesson.type === "video")
            return !lesson.cfVideoUid && !lesson.hasVideo;
          if (lesson.type === "quiz") {
            return !lesson.quiz?.questions.some(
              (question) =>
                question.prompt.trim() &&
                question.options.filter((option) => option.text.trim())
                  .length >= 2 &&
                question.options.some(
                  (option) =>
                    option.text.trim() &&
                    option.id === question.correctOptionId,
                ),
            );
          }
          return !lesson.articleContent.trim() && !hasResource;
        });
      if (incomplete.length > 0) {
        toast.error(
          `Complete all lessons before submitting. ${incomplete.length} lesson${incomplete.length === 1 ? "" : "s"} still needs content.`,
        );
        return;
      }
    }
    if (!subtitle.trim()) {
      toast.error("Subtitle is required.");
      return;
    }
    if (!category.trim()) {
      toast.error("Category is required.");
      return;
    }
    if (
      !isoStandard.trim() ||
      (isoStandard === "OTHER" && !customIsoStandard.trim())
    ) {
      toast.error(
        isoStandard === "OTHER"
          ? "Custom ISO Standard is required."
          : "ISO Standard is required.",
      );
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required.");
      return;
    }
    if (!thumbnail.trim()) {
      toast.error("Course thumbnail is required.");
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
      toast.error(
        `Description cannot exceed ${MAX_COURSE_DESCRIPTION_LENGTH} characters`,
      );
      return;
    }
    const priceCents = Math.round(Number(price) * 100);
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      toast.error("Course price must be greater than zero.");
      return;
    }
    setSaving(true);
    setSavingAction(action);
    try {
      const fields = {
        title: title.trim(),
        subtitle,
        description,
        category: categoryValue,
        isoStandard:
          isoStandard === "OTHER" ? customIsoStandard.trim() : isoStandard,
        level: LEVEL_TO_API[level],
        thumbnail,
        basePriceCents: priceCents,
      };
      const targetStatus =
        action === "publish"
          ? "PUBLISHED"
          : action === "review"
            ? "REVIEW"
            : "DRAFT";

      // Validate before any existing-course writes. The status endpoint still
      // validates when it commits, but this prevents partial saves when an
      // organization assignment blocks Draft/Review.
      if (courseId && detail?.status !== targetStatus) {
        await authoringApi.validateCourseStatus(courseId, targetStatus);
      }
      const saved = courseId
        ? await authoringApi.updateCourse(courseId, fields)
        : await authoringApi.createCourse(fields);
      const id = saved.id;

      // Deletions first (anything loaded from the server but no longer present).
      const keptSections = new Set(sections?.map((s) => s.id) ?? []);
      const keptLessons = new Set(
        sections?.flatMap((s) => s.lessons?.map((l) => l.id) ?? []) ?? [],
      );
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
            (await authoringApi.course(id)).sections?.map((x) => x.id) ?? [],
          );
          const after = await authoringApi.addSection(id, {
            title: s.title,
            order: si,
          });
          sectionServerId =
            after.sections?.find((x) => !before.has(x.id))?.id ?? s.id;
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
            ...(l.type === "article"
              ? { articleContent: l.articleContent }
              : {}),
            // Only complete rows are sent; the API rejects a resource without a URL.
            resources:
              l.resources?.filter((r) => r.name.trim() && r.url.trim()) ?? [],
          };
          let lessonServerId = l.id;
          if (isTemp(l.id)) {
            const before = new Set(
              (await authoringApi.course(id)).sections
                .flatMap((x) => x.lessons)
                .map((x) => x.id),
            );
            const after = await authoringApi.addLesson(
              sectionServerId,
              lessonBody,
            );
            lessonServerId =
              after.sections
                .flatMap((x) => x.lessons)
                .find((x) => !before.has(x.id))?.id ?? l.id;
          } else {
            await authoringApi.updateLesson(l.id, lessonBody);
          }
          lessonServerIds.set(l.id, lessonServerId);

          // A remove flag can be set for a brand-new lesson that never had a
          // server attachment. Only delete when the loaded server state proves
          // that an asset existed; the API is idempotent as a race-safe fallback.
          if (
            l.removePptx &&
            !l.pendingPptxFile &&
            l.hasServerPptx &&
            !isTemp(lessonServerId)
          )
            await authoringApi.deleteLessonPptx(lessonServerId);
          if (l.pendingPptxFile && !isTemp(lessonServerId))
            await authoringApi.uploadLessonPptx(
              lessonServerId,
              l.pendingPptxFile,
              l.pptxDurationSec,
            );
          for (const file of l.pendingResourceFiles) {
            await authoringApi.uploadLessonResource(lessonServerId, file);
          }

          // Sync quiz content for quiz lessons (replace-all strategy).
          if (l.type === "quiz" && l.quiz && (l.quizDirty || isTemp(l.id))) {
            const quiz = await authoringApi.upsertQuiz(
              lessonServerId,
              l.quiz.passScore,
            );
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
      if (saved.status !== targetStatus) {
        await authoringApi.setCourseStatus(id, targetStatus);
      }

      // Visibility change, applied last so a same-save "publish + make
      // private" combo sees the course as already Published server-side —
      // the API requires PUBLISHED before it will accept PRIVATE.
      if (mode === "admin" && courseId && visibility !== detail?.visibility) {
        await authoringApi.updateCourse(id, { visibility });
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
          : lowerMessage.includes("description") &&
              message.includes(String(MAX_COURSE_DESCRIPTION_LENGTH))
            ? `Description cannot exceed ${MAX_COURSE_DESCRIPTION_LENGTH} characters`
            : message;
      toast.error(friendlyMessage);
    } finally {
      setSaving(false);
      setSavingAction(null);
    }
  }

  return {
    detail, isLoading, title, setTitle, subtitle, setSubtitle, category, setCategory,
    isoStandard, setIsoStandard, customIsoStandard, setCustomIsoStandard, level, setLevel,
    description, setDescription, price, setPrice, thumbnail, setThumbnail, thumbDrag, setThumbDrag,
    thumbError, setThumbError, thumbInputRef, categoryValue, titleTooLong, subtitleTooLong,
    descriptionTooLong, published, setPublished, visibility, setVisibility, saving, savingAction,
    dragSection, setDragSection, collapsedSections, sections, totalLessons, moveSection,
    addSection, patchSection, removeSection, addLesson, patchLesson, setLessonType, removeLesson,
    handleThumbnailFile, save, onBack: () => router.push(backHref), toggleSectionCollapsed,
  };
}