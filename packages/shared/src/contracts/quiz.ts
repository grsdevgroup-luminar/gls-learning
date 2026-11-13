import { z } from "zod";

export const QuizQuestionType = {
  MCQ: "MCQ",
  WRITTEN: "WRITTEN",
} as const;
export type QuizQuestionType = (typeof QuizQuestionType)[keyof typeof QuizQuestionType];

// What a student receives to take a quiz — NEVER includes which option is correct.
export interface QuizOptionPublicDto {
  id: string;
  text: string;
}
export interface QuizQuestionPublicDto {
  id: string;
  scenario: string | null;
  group: QuizGroupPublicDto | null;
  questionType: QuizQuestionType;
  prompt: string;
  order: number;
  multipleAnswers: boolean;
  options: QuizOptionPublicDto[];
}
export interface QuizGroupPublicDto {
  id: string;
  label: string;
  title: string | null;
  scenario: string | null;
  marks: number | null;
  order: number;
}
export interface QuizPlayDto {
  lessonId: string;
  passScore: number;
  questions: QuizQuestionPublicDto[];
}

export const quizAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        optionId: z.string().min(1).optional(),
        optionIds: z.array(z.string().min(1)).min(1).optional(),
        writtenAnswer: z.string().max(20000).optional(),
      }).refine((answer) => !!answer.optionId || !!answer.optionIds?.length || !!answer.writtenAnswer?.trim(), {
        message: "Provide an answer",
      }),
    )
    .min(1),
});
export type QuizAttemptInput = z.infer<typeof quizAttemptSchema>;

// Per-question feedback returned AFTER grading (now safe to reveal answers).
export interface QuizQuestionResultDto {
  questionId: string;
  selectedOptionIds: string[];
  correctOptionIds: string[];
  /** Legacy single-answer fields retained for existing consumers. */
  selectedOptionId: string | null;
  correctOptionId: string;
  correct: boolean;
  explanation?: string;
  questionType?: QuizQuestionType;
  writtenAnswer?: string;
  pendingReview?: boolean;
}
export interface QuizAttemptResultDto {
  lessonId: string;
  score: number; // percent
  passed: boolean;
  bestScore: number;
  attempts: number;
  results: QuizQuestionResultDto[];
  /** present when passing the quiz auto-completed the lesson */
  progressPct?: number;
  reviewStatus?: "AUTO_GRADED" | "PENDING_REVIEW" | "GRADED";
}

export interface QuizResultDto {
  lessonId: string;
  bestScore: number;
  lastScore: number;
  attempts: number;
  passed: boolean;
  lastAttemptAt: string;
  reviewStatus?: "AUTO_GRADED" | "PENDING_REVIEW" | "GRADED";
}

export interface QuizSubmissionSummaryDto {
  id: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  lessonId: string;
  quizTitle: string;
  score: number;
  passed: boolean;
  reviewStatus: "AUTO_GRADED" | "PENDING_REVIEW" | "GRADED";
  writtenAnswerCount: number;
  pendingAnswerCount: number;
  createdAt: string;
}

export interface QuizSubmissionDetailDto extends QuizSubmissionSummaryDto {
  answers: Array<{
    id: string;
    questionId: string;
    prompt: string;
    questionType: QuizQuestionType;
    marks: number;
    studentAnswer: string;
    score: number | null;
    feedback: string | null;
    status: "PENDING_REVIEW" | "GRADED";
    gradedBy: string | null;
    gradedAt: string | null;
  }>;
}

export const gradeWrittenAnswerSchema = z.object({
  score: z.number().int().min(0),
  feedback: z.string().max(5000).optional(),
});
export type GradeWrittenAnswerInput = z.infer<typeof gradeWrittenAnswerSchema>;
