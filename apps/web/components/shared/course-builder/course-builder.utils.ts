import type { CourseDetailDto } from "@grslearning/shared";
import type { BuilderQuiz } from "@/components/shared/quiz-editor";
import type { BSection } from "./course-builder.types";
import { TYPE_FROM_API } from "./course-builder.types";

const MAX_THUMBNAIL_DIM = 800;
const THUMBNAIL_JPEG_QUALITY = 0.82;

export function readImageFile(
  file: File,
  maxDim = MAX_THUMBNAIL_DIM,
  quality = THUMBNAIL_JPEG_QUALITY,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.onload = () => {
      const img = new window.Image();
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

let uid = 1000;
export const nid = (prefix: string) => `new_${prefix}${uid++}`;
export const isTemp = (id: string) => id.startsWith("new_");

const ARTICLE_WORDS_PER_MINUTE = 200;
const ARTICLE_MIN_DURATION_SEC = 30;
export function articleDurationSec(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(
    ARTICLE_MIN_DURATION_SEC,
    Math.round((words / ARTICLE_WORDS_PER_MINUTE) * 60),
  );
}

export function quizDurationSec(
  quiz: Pick<BuilderQuiz, "questions" | "minutesPerQuestion">,
): number {
  return quiz.questions.length * quiz.minutesPerQuestion * 60;
}

export const thumbSeeds = [
  "course", "react", "ml", "design", "aws", "growth", "python",
  "system", "typescript", "speaking", "social", "finance", "mindfulness", "language",
];

export function sectionsFromDetail(detail: CourseDetailDto): BSection[] {
  return detail.sections?.map((section) => ({
    id: section.id,
    isNew: false,
    title: section.title,
    lessons: section.lessons.map((lesson) => ({
      id: lesson.id,
      isNew: false,
      title: lesson.title,
      preview: !!lesson.preview,
      hasVideo: lesson.hasVideo,
      cfVideoUid: null,
      uploadId: null,
      replacingVideo: false,
      videoLabel: null,
      articleContent: lesson.articleContent ?? "",
      resources: lesson.resources ?? [],
      pendingResourceFiles: [],
      pptxName: lesson.pptx?.name ?? null,
      hasServerPptx: !!lesson.pptx,
      pendingPptxFile: null,
      removePptx: false,
      durationSec: lesson.durationSec,
      type: TYPE_FROM_API[lesson.type] ?? "video",
      quiz: undefined,
    })),
  }));
}