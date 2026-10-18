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
  async getForPlay(userId: string, lessonId: string, userRole?: string): Promise<QuizPlayDto> {
    const lesson = await this.repo.findLessonContext(lessonId);
    if (!lesson || !lesson.quiz)
      throw new NotFoundException("No quiz for this lesson");

    const orgAdminReadOnly = userRole === "ORG_ADMIN";
    if (orgAdminReadOnly) {
      await this.enrollment.assertOrgAdminAssignedCourseAccess(
        userId,
        lesson.section.courseId,
      );
    }
    const enrolled = await this.enrollment.isEnrolled(
      userId,
      lesson.section.courseId,
    );
    if (!enrolled && !lesson.preview && !orgAdminReadOnly)
      throw new ForbiddenException("Enroll to access this quiz");
    if (enrolled && !orgAdminReadOnly) {
      await this.enrollment.assertLessonAccessible(userId, lessonId);
    }

    return {
      lessonId,
      passScore: lesson.quiz.passScore,
      questions: lesson.quiz.questions.map((q) => ({
        id: q.id,
        scenario: q.scenario,
        prompt: q.prompt,
        order: q.order,
        multipleAnswers: q.options.filter((o) => o.isCorrect).length > 1,
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
    await this.enrollment.assertLessonAccessible(userId, lessonId);

    const answerByQuestion = new Map(
      input.answers.map((a) => [
        a.questionId,
        [...new Set(a.optionIds ?? (a.optionId ? [a.optionId] : []))],
      ]),
    );

    const results = lesson.quiz.questions.map((q) => {
      const correctOptionIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
      const selectedOptionIds = answerByQuestion.get(q.id) ?? [];
      const correct =
        selectedOptionIds.length === correctOptionIds.length &&
        selectedOptionIds.every((id) => correctOptionIds.includes(id));
      return {
        questionId: q.id,
        selectedOptionIds,
        correctOptionIds,
        selectedOptionId: selectedOptionIds[0] ?? null,
        correctOptionId: correctOptionIds[0] ?? "",
        correct,
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
