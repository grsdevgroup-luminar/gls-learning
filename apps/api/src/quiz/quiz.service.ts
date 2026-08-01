import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  quizPassed,
  type QuizAttemptInput,
  type QuizAttemptResultDto,
  type QuizPlayDto,
  type QuizResultDto,
} from "@skillstream/shared";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { QuizRepository } from "./quiz.repository";

@Injectable()
export class QuizService {
  constructor(
    private readonly repo: QuizRepository,
    private readonly enrollment: EnrollmentService,
  ) {}

  /** Quiz questions for the player — correctness is intentionally stripped. */
  async getForPlay(userId: string, lessonId: string): Promise<QuizPlayDto> {
    const lesson = await this.repo.findLessonContext(lessonId);
    if (!lesson || !lesson.quiz)
      throw new NotFoundException("No quiz for this lesson");

    const enrolled = await this.enrollment.isEnrolled(
      userId,
      lesson.section.courseId,
    );
    if (!enrolled && !lesson.preview)
      throw new ForbiddenException("Enroll to access this quiz");

    return {
      lessonId,
      passScore: lesson.quiz.passScore,
      questions: lesson.quiz.questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        order: q.order,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
      })),
    };
  }

  async submitAttempt(
    userId: string,
    lessonId: string,
    input: QuizAttemptInput,
  ): Promise<QuizAttemptResultDto> {
    const lesson = await this.repo.findLessonContext(lessonId);
    if (!lesson || !lesson.quiz)
      throw new NotFoundException("No quiz for this lesson");

    const courseId = lesson.section.courseId;
    const enrolled = await this.enrollment.isEnrolled(userId, courseId);
    if (!enrolled) throw new ForbiddenException("Enroll to submit this quiz");

    const answerByQuestion = new Map(
      input.answers.map((a) => [a.questionId, a.optionId]),
    );

    const results = lesson.quiz.questions.map((q) => {
      const correctOption = q.options.find((o) => o.isCorrect);
      const selectedOptionId = answerByQuestion.get(q.id) ?? null;
      return {
        questionId: q.id,
        selectedOptionId,
        correctOptionId: correctOption?.id ?? "",
        correct: selectedOptionId != null && selectedOptionId === correctOption?.id,
        explanation: q.explanation ?? undefined,
      };
    });

    const correctCount = results.filter((r) => r.correct).length;
    const score = Math.round((correctCount / results.length) * 100);
    const passed = quizPassed(score, lesson.quiz.passScore);

    const prev = await this.repo.findQuizResult(userId, lessonId);
    const bestScore = Math.max(prev?.bestScore ?? 0, score);
    const attempts = (prev?.attempts ?? 0) + 1;

    await this.repo.saveAttempt(
      userId,
      lessonId,
      score,
      passed,
      bestScore,
      attempts,
      prev?.passed ?? false,
    );

    let progressPct: number | undefined;
    if (passed) {
      await this.enrollment.markLessonComplete(userId, courseId, lessonId);
      const e = await this.enrollment.getOne(userId, courseId);
      progressPct = e.progressPct;
    }

    return {
      lessonId,
      score,
      passed,
      bestScore,
      attempts,
      results,
      progressPct,
    };
  }

  async getResult(
    userId: string,
    lessonId: string,
  ): Promise<QuizResultDto | null> {
    const r = await this.repo.findQuizResult(userId, lessonId);
    if (!r) return null;
    return {
      lessonId,
      bestScore: r.bestScore,
      lastScore: r.lastScore,
      attempts: r.attempts,
      passed: r.passed,
      lastAttemptAt: r.lastAttemptAt.toISOString(),
    };
  }
}
