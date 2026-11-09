import type { LessonResourceDto } from "@grslearning/shared";
import type { BuilderQuiz } from "@/components/shared/quiz-editor";

export const MAX_SUBTITLE_LENGTH = 240;
export const MAX_TITLE_LENGTH = 100;

export type BuilderLessonType = "video" | "quiz" | "article";

export interface BLesson {
  id: string;
  isNew: boolean;
  title: string;
  preview: boolean;
  hasVideo: boolean;
  cfVideoUid: string | null;
  uploadId: string | null;
  replacingVideo: boolean;
  videoLabel: string | null;
  articleContent: string;
  resources: LessonResourceDto[];
  pendingResourceFiles: File[];
  pptxName: string | null;
  hasServerPptx: boolean;
  pendingPptxFile: File | null;
  removePptx: boolean;
  durationSec: number;
  type: BuilderLessonType;
  quiz?: BuilderQuiz;
  quizDirty?: boolean;
}

export interface BSection {
  id: string;
  isNew: boolean;
  title: string;
  lessons: BLesson[];
}

export const lessonTypes: { value: BuilderLessonType; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "quiz", label: "Quiz" },
  { value: "article", label: "Article" },
];

export const LEVEL_TO_API = {
  Beginner: "BEGINNER",
  Intermediate: "INTERMEDIATE",
  Advanced: "ADVANCED",
  "All Levels": "ALL_LEVELS",
} as const;

export const LEVEL_FROM_API: Record<string, keyof typeof LEVEL_TO_API> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  ALL_LEVELS: "All Levels",
};

export const TYPE_TO_API = {
  video: "VIDEO",
  quiz: "QUIZ",
  article: "ARTICLE",
} as const;

export const TYPE_FROM_API: Record<string, BuilderLessonType> = {
  VIDEO: "video",
  QUIZ: "quiz",
  ARTICLE: "article",
};