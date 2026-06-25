import { z } from "zod";

// What a student receives to take a quiz — NEVER includes which option is correct.
export interface QuizOptionPublicDto {
  id: string;
  text: string;
}
export interface QuizQuestionPublicDto {
  id: string;
  prompt: string;
  order: number;
  options: QuizOptionPublicDto[];
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
        optionId: z.string().min(1),
      }),
    )
    .min(1),
});
export type QuizAttemptInput = z.infer<typeof quizAttemptSchema>;

// Per-question feedback returned AFTER grading (now safe to reveal answers).
export interface QuizQuestionResultDto {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  correct: boolean;
  explanation?: string;
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
}

export interface QuizResultDto {
  lessonId: string;
  bestScore: number;
  lastScore: number;
  attempts: number;
  passed: boolean;
  lastAttemptAt: string;
}
