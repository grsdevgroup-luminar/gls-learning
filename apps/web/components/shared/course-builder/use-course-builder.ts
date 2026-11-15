"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ISO_STANDARD_OPTIONS, MAX_COURSE_DESCRIPTION_LENGTH, type CourseResourceDto } from "@grslearning/shared";
import { authoringApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { emptyQuiz, flattenQuizQuestions, MAX_QUIZ_GROUP_LABEL_LENGTH, MAX_QUIZ_OPTION_LENGTH } from "@/components/shared/quiz-editor";
import { toast } from "sonner";
import {
  articleDurationSec, isTemp, nid, quizDurationSec, readImageFile, sectionsFromDetail,
} from "./course-builder.utils";
import {
  LEVEL_FROM_API, LEVEL_TO_API, MAX_SUBTITLE_LENGTH, MAX_TITLE_LENGTH, TYPE_TO_API,
  type BLesson, type BSection, type BuilderLessonType,
} from "./course-builder.types";

export function useCourseBuilder({ courseId, mode, revisionMode = false }: { courseId?: string; mode: "admin" | "instructor"; revisionMode?: boolean }) {  const router = useRouter();
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
  const [courseResources, setCourseResources] = useState<CourseResourceDto[]>([]);
  const [pendingCourseResourceFiles, setPendingCourseResourceFiles] = useState<File[]>([]);
  const [removedCourseResourceIds, setRemovedCourseResourceIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<
    "draft" | "publish" | "review" | null
  >(null);
  const [submissionIssues, setSubmissionIssues] = useState<{
    sectionId: string; lessonId: string; sectionTitle: string; lessonTitle: string; reason: string;
  }[]>([]);
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
    setCourseResources(detail.courseResources ?? []);
    setPendingCourseResourceFiles([]);
    setRemovedCourseResourceIds(new Set());
    setSubmissionIssues([]);
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
                          groups: qz.questions.reduce<import("@/components/shared/quiz-editor").BuilderQuizGroup[]>((groups, q) => {
                            const scenario = q.group?.scenario ?? q.scenario ?? "";
                            const question = {
                              id: q.id,
                              questionType: q.questionType,
                              marks: q.marks,
                              wordLimitMin: q.wordLimitMin ?? undefined,
                              wordLimitMax: q.wordLimitMax ?? undefined,
                              modelAnswer: q.modelAnswer ?? undefined,
                              gradingRubric: q.gradingRubric ?? undefined,
                              prompt: q.prompt,
                              explanation: q.explanation ?? undefined,
                              options: q.options?.map((o) => ({ id: o.id, text: o.text })) ?? [],
                              correctOptionIds: q.options?.filter((o) => o.isCorrect).map((o) => o.id) ?? [],
                              multipleAnswers: q.multipleAnswers,
                            };
                            const last = groups[groups.length - 1];
                            if (last && last.scenario === scenario && last.label === (q.group?.label ?? "")) last.questions.push(question);
                            else groups.push({ id: `loaded-${q.id}`, label: q.group?.label ?? "", title: q.group?.title ?? "", scenario, marks: q.group?.marks ?? undefined, questions: [question] });
                            return groups;
                          }, []),
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

  function addSection(insertAt?: number) {
    setSections((s) => {
      const index = Math.max(0, Math.min(insertAt ?? s.length, s.length));
      const next = [...s];
      next.splice(index, 0, {
        id: nid("s"),
        isNew: true,
        title: `Section ${index + 1}`,
        lessons: [],
      });
      return next;
    });
  }
  function patchSection(id: string, p: Partial<BSection>) {
    if (p.title !== undefined) {
      const sectionTitle = p.title;
      setSubmissionIssues((issues) => issues.map((issue) => issue.sectionId === id ? { ...issue, sectionTitle } : issue));
    }
    setSections((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  function removeSection(id: string) {
    setSubmissionIssues((issues) => issues.filter((issue) => issue.sectionId !== id));
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
    if (p.type || p.cfVideoUid || p.hasVideo || p.articleContent !== undefined || p.resources || p.pendingResourceFiles || p.quiz) {
      setSubmissionIssues((issues) => issues.filter((issue) => issue.lessonId !== lid));
    } else if (p.title !== undefined) {
      const lessonTitle = p.title || "Untitled lesson";
      setSubmissionIssues((issues) => issues.map((issue) => issue.lessonId === lid ? { ...issue, lessonTitle } : issue));
    }
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
    setSubmissionIssues((issues) => issues.filter((issue) => issue.lessonId !== lid));
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
    const longLabel = sections.flatMap((section) => section.lessons.flatMap((lesson) =>
      lesson.quiz?.groups.filter((group) => group.label.trim().length > MAX_QUIZ_GROUP_LABEL_LENGTH)
        .map((group) => ({ section, lesson, group })) ?? [],
    ))[0];
    if (longLabel) {
      toast.error("Quiz section label is too long", {
        description: `${longLabel.section.title || "Untitled section"} → ${longLabel.lesson.title || "Untitled lesson"}: shorten the label to 80 characters. Use Section title for longer text.`,
      });
      requestAnimationFrame(() => document.getElementById(`quiz-group-${longLabel.group.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    const longOption = sections.flatMap((section) => section.lessons.flatMap((lesson) =>
      lesson.quiz?.groups.flatMap((group) => group.questions.flatMap((question) =>
        question.options.map((option, index) => ({ section, lesson, question, option, index }))
          .filter(({ option }) => option.text.length > MAX_QUIZ_OPTION_LENGTH),
      )) ?? [],
    ))[0];
    if (longOption) {
      toast.error(`Quiz answer option ${longOption.index + 1} is too long`, {
        description: `${longOption.section.title || "Untitled section"} → ${longOption.lesson.title || "Untitled lesson"}, “${longOption.question.prompt || "Untitled question"}”: shorten the option to ${MAX_QUIZ_OPTION_LENGTH} characters.`,
      });
      requestAnimationFrame(() => document.getElementById(`quiz-option-${longOption.option.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    if ((action === "publish" || action === "review") && totalLessons === 0) {
      toast.error("Add at least one lesson before submitting this course.");
      return;
    }
    if (action === "publish" || action === "review") {
      const issues = (
        await Promise.all(
          sections.flatMap((section) => section.lessons.map(async (lesson) => {
          const hasResource =
            lesson.resources.some(
              (resource) => resource.name.trim() && resource.url.trim(),
            ) || lesson.pendingResourceFiles.length > 0;
          let reason: string | null = null;
          if (lesson.type === "video") {
            if (!lesson.cfVideoUid && !lesson.hasVideo) reason = "Upload a video.";
          }
          if (lesson.type === "quiz") {
            // Existing quiz content loads asynchronously after the course
            // detail. Read it directly if that request has not finished yet,
            // so a valid quiz is not reported as an empty lesson. Scenario is
            // intentionally not part of this check; it is optional.
            let quiz: BLesson["quiz"] | Awaited<ReturnType<typeof authoringApi.quiz>> | null = lesson.quiz ?? null;
            if (!quiz && !isTemp(lesson.id)) {
              try { quiz = await authoringApi.quiz(lesson.id); }
              catch { reason = "Could not load the quiz. Check the lesson and try again."; }
            }
            if (!reason && !quiz) reason = "Add at least one quiz question.";
            if (!reason && quiz && "groups" in quiz) {
              const valid = quiz.groups.some((group) =>
                group.questions.some(
                  (question) =>
                    question.prompt.trim() &&
                    (question.questionType === "WRITTEN" || (
                      question.options.filter((option) => option.text.trim()).length >= 2 &&
                      question.options.some((option) => option.text.trim() && question.correctOptionIds.includes(option.id))
                    )),
                ),
              );
              if (!valid) reason = "Add a written question with text, or an MCQ with text, two options, and a correct answer.";
            } else if (!reason && quiz && "questions" in quiz) {
              const valid = quiz.questions.some((question) =>
                question.prompt.trim() &&
                (question.questionType === "WRITTEN" || (
                  question.options.filter((option) => option.text.trim()).length >= 2 &&
                  question.options.some((option) => option.text.trim() && option.isCorrect)
                )),
              );
              if (!valid) reason = "Add a written question with text, or an MCQ with text, two options, and a correct answer.";
            }
          }
          if (lesson.type === "article" && !lesson.articleContent.trim() && !hasResource) {
            reason = "Write article content or add a downloadable resource.";
          }
          return reason ? {
            sectionId: section.id, lessonId: lesson.id,
            sectionTitle: section.title, lessonTitle: lesson.title || "Untitled lesson", reason,
          } : null;
          })),
        )
      ).filter((issue): issue is NonNullable<typeof issue> => issue !== null);
      setSubmissionIssues(issues);
      if (issues.length > 0) {
        toast.error(
          `${issues.length} lesson${issues.length === 1 ? "" : "s"} need content: ${issues[0].lessonTitle}`,
          { description: `${issues[0].reason} See Curriculum for ${issues.length === 1 ? "the lesson" : "all affected lessons"}.` },
        );
        requestAnimationFrame(() => document.getElementById("course-submission-issues")?.scrollIntoView({ behavior: "smooth", block: "center" }));
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
      // Admin Save normally edits the existing course without requesting a
      // status transition. This is important for REVIEW courses: turning Save
      // into REVIEW -> DRAFT would incorrectly discard the review state. A
      // published course is different: when the admin turns the Publish
      // switch off, Save must explicitly transition it to DRAFT.
      const targetStatus =
        mode === "admin" && action === "draft" && detail?.status === "REVIEW"
          ? "REVIEW"
          : action === "publish"
            ? "PUBLISHED"
            : action === "review"
              ? "REVIEW"
              : "DRAFT";

      // Unpublishing can be checked before writes. Publishing/review must be
      // checked after saving edited lesson content, or the old server snapshot
      // may reject a lesson that was just fixed in the editor.
      if (courseId && detail?.status !== targetStatus && targetStatus === "DRAFT") {
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
            await authoringApi.clearQuizGroups(quiz.id);
            for (const [qi, item] of flattenQuizQuestions(l.quiz).entries()) {
              const { question: q, scenario, groupLabel, groupTitle, groupScenario, groupMarks, groupOrder } = item;
              const options = q.options
                .filter((o) => o.text.trim())
                .map((o, oi) => ({
                  text: o.text,
                  isCorrect: q.correctOptionIds.includes(o.id),
                  order: oi,
                }));
              if (!q.prompt.trim() || (q.questionType === "MCQ" && options.length < 2)) continue;
              await authoringApi.addQuizQuestion(quiz.id, {
                questionType: q.questionType,
                marks: q.marks,
                wordLimitMin: q.wordLimitMin,
                wordLimitMax: q.wordLimitMax,
                gradingRubric: q.gradingRubric || undefined,
                scenario: scenario || undefined,
                groupLabel: groupLabel || undefined,
                groupTitle: groupTitle || undefined,
                groupScenario: groupScenario || undefined,
                groupMarks,
                groupOrder,
                prompt: q.prompt,
                explanation: q.explanation || undefined,
                order: qi,
                options: q.questionType === "MCQ" ? options : [],
              });
            }
          }
        }
      }

      for (const resourceId of removedCourseResourceIds) {
        await authoringApi.deleteCourseResource(id, resourceId);
      }
      for (const file of pendingCourseResourceFiles) {
        await authoringApi.uploadCourseResource(id, file);
      }

      // Status transition.
      if (saved.status !== targetStatus) {
        await authoringApi.setCourseStatus(id, targetStatus);
      }

      if (revisionMode && action === "review") {
        await authoringApi.submitCourseRevision(id);
      }

      // Visibility change, applied last so a same-save "publish + make
      // private" combo sees the course as already Published server-side —
      // the API requires PUBLISHED before it will accept PRIVATE.
      if (mode === "admin" && courseId && visibility !== detail?.visibility) {
        await authoringApi.updateCourse(id, { visibility });
      }

      void qc.invalidateQueries({ queryKey: ["authoring", "course", id] });
      void qc.invalidateQueries({ queryKey: ["instructor", "courses"] });
      void qc.invalidateQueries({ queryKey: ["instructor", "profile"] });
      void qc.invalidateQueries({ queryKey: ["instructor-profile"] });
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
        /options\.\d+\.text/.test(lowerMessage) && message.includes(String(MAX_QUIZ_OPTION_LENGTH))
          ? `A quiz answer option must be ${MAX_QUIZ_OPTION_LENGTH} characters or fewer. Shorten the indicated option and save again.`
          : lowerMessage.includes("grouplabel") && message.includes("80")
          ? "Quiz section label must be 80 characters or fewer. Put longer text in Section title or the scenario field."
          : lowerMessage.includes("subtitle") && message.includes("240")
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
    descriptionTooLong, published, setPublished, visibility, setVisibility, courseResources,
    pendingCourseResourceFiles, saving, savingAction,
    dragSection, setDragSection, collapsedSections, sections, totalLessons, moveSection, submissionIssues,
    revealLesson: (sectionId: string, lessonId: string) => {
      setCollapsedSections((current) => {
        const next = new Set(current);
        next.delete(sectionId);
        return next;
      });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.getElementById(`course-lesson-${lessonId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }));
    },
    addSection, patchSection, removeSection, addLesson, patchLesson, setLessonType, removeLesson,
    handleThumbnailFile,
    addCourseResourceFiles: (files: File[]) => {
      if (files.length > 0) setPendingCourseResourceFiles((current) => [...current, ...files]);
    },
    removeCourseResource: (id: string) => {
      setCourseResources((current) => current.filter((resource) => resource.id !== id));
      setRemovedCourseResourceIds((current) => new Set(current).add(id));
    },
    removePendingCourseResource: (index: number) => setPendingCourseResourceFiles((current) => current.filter((_, i) => i !== index)),
    save, onBack: () => router.push(backHref), toggleSectionCollapsed,
  };
}
