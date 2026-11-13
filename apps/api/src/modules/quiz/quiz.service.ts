import {
  BadRequestException,
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
  type QuizSubmissionDetailDto,
  type QuizSubmissionSummaryDto,
  type GradeWrittenAnswerInput,
} from "@grslearning/shared";
import type { RequestUser } from "../../common/decorators/decorators";
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
        group: q.group,
        questionType: q.questionType,
        marks: q.marks,
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

    const answerByQuestion = new Map(input.answers.map((a) => [a.questionId, a]));
    for (const question of lesson.quiz.questions) {
      const answer = answerByQuestion.get(question.id);
      if (!answer || (question.questionType === "WRITTEN" ? !answer.writtenAnswer?.trim() : !(answer.optionIds?.length || answer.optionId))) {
        throw new BadRequestException("Answer every quiz question before submitting");
      }
    }
    const writtenQuestions = lesson.quiz.questions.filter((q) => q.questionType === "WRITTEN");
    const totalMarks = lesson.quiz.questions.reduce((sum, q) => sum + q.marks, 0);

    const results = lesson.quiz.questions.map((q) => {
      const answer = answerByQuestion.get(q.id);
      const correctOptionIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
      const selectedOptionIds = [...new Set(answer?.optionIds ?? (answer?.optionId ? [answer.optionId] : []))];
      const correct = q.questionType === "MCQ" && selectedOptionIds.length === correctOptionIds.length && selectedOptionIds.every((id) => correctOptionIds.includes(id));
      return {
        questionId: q.id,
        selectedOptionIds,
        correctOptionIds,
        selectedOptionId: selectedOptionIds[0] ?? null,
        correctOptionId: correctOptionIds[0] ?? "",
        correct,
        explanation: q.explanation ?? undefined,
        questionType: q.questionType,
        writtenAnswer: answer?.writtenAnswer,
        pendingReview: q.questionType === "WRITTEN",
      };
    });

    const earnedMarks = lesson.quiz.questions.reduce((sum, q, i) => sum + (results[i].correct ? q.marks : 0), 0);
    const hasWritten = writtenQuestions.length > 0;
    const score = totalMarks ? Math.round((earnedMarks / totalMarks) * 100) : 0;
    const passed = !hasWritten && quizPassed(score, lesson.quiz.passScore);

    const prev = await this.repo.findQuizResult(userId, lessonId);
    const bestScore = Math.max(prev?.bestScore ?? 0, score);
    const attempts = (prev?.attempts ?? 0) + 1;

    const attempt = await this.repo.saveAttempt(
      userId,
      lessonId,
      score,
      passed,
      bestScore,
      attempts,
      prev?.passed ?? false,
      {
        reviewStatus: hasWritten ? "PENDING_REVIEW" : "AUTO_GRADED",
        earnedMarks,
        totalMarks,
        writtenAnswers: writtenQuestions.map((q) => ({ questionId: q.id, answer: answerByQuestion.get(q.id)?.writtenAnswer?.trim() ?? "" })),
      },
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
      reviewStatus: hasWritten ? "PENDING_REVIEW" : "AUTO_GRADED",
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
      reviewStatus: r.reviewStatus,
    };
  }

  private async assertReviewer(user: RequestUser, courseId: string) {
    const course = await this.repo.findCourseReviewerContext(courseId);
    if (!course) throw new NotFoundException("Course not found");
    if (user.role !== "ADMIN" && course.instructorId !== user.id) throw new ForbiddenException("Not your course");
    return course;
  }

  async listSubmissions(user: RequestUser, courseId: string): Promise<QuizSubmissionSummaryDto[]> {
    await this.assertReviewer(user, courseId);
    const rows = await this.repo.findQuizSubmissions(courseId);
    return rows.map((row) => ({
      id: row.id, studentName: row.user.name, studentEmail: row.user.email,
      courseId, courseTitle: row.lesson.section.course.title, lessonId: row.lesson.id,
      quizTitle: row.lesson.title, score: row.score, passed: row.passed,
      reviewStatus: row.reviewStatus, writtenAnswerCount: row.writtenAnswers.length,
      pendingAnswerCount: row.writtenAnswers.filter((a) => a.score == null).length,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getSubmission(user: RequestUser, attemptId: string): Promise<QuizSubmissionDetailDto> {
    const row = await this.repo.findQuizSubmission(attemptId);
    if (!row) throw new NotFoundException("Quiz submission not found");
    const course = await this.assertReviewer(user, row.lesson.section.course.id);
    return {
      id: row.id, studentName: row.user.name, studentEmail: row.user.email,
      courseId: course.id, courseTitle: course.title, lessonId: row.lesson.id,
      quizTitle: row.lesson.title, score: row.score, passed: row.passed,
      reviewStatus: row.reviewStatus, writtenAnswerCount: row.writtenAnswers.length,
      pendingAnswerCount: row.writtenAnswers.filter((a) => a.score == null).length,
      createdAt: row.createdAt.toISOString(),
      answers: row.writtenAnswers.map((a) => ({ id: a.id, questionId: a.questionId, prompt: a.question.prompt, questionType: a.question.questionType, marks: a.question.marks, studentAnswer: a.answer, score: a.score, feedback: a.feedback, status: a.score == null ? "PENDING_REVIEW" : "GRADED", gradedBy: a.gradedBy?.name ?? null, gradedAt: a.gradedAt?.toISOString() ?? null })),
    };
  }

  async gradeWrittenAnswer(user: RequestUser, attemptId: string, answerId: string, input: GradeWrittenAnswerInput) {
    const row = await this.repo.findQuizSubmission(attemptId);
    if (!row) throw new NotFoundException("Quiz submission not found");
    await this.assertReviewer(user, row.lesson.section.course.id);
    const answer = row.writtenAnswers.find((item) => item.id === answerId);
    if (!answer) throw new NotFoundException("Written answer not found");
    if (input.score > answer.question.marks) throw new BadRequestException(`Score cannot exceed ${answer.question.marks}`);
    await this.repo.gradeWrittenAnswer(answerId, user.id, input.score, input.feedback?.trim() || null);
    const refreshed = await this.repo.findQuizSubmission(attemptId);
    if (refreshed && refreshed.writtenAnswers.every((item) => item.score != null)) {
      const earnedWritten = refreshed.writtenAnswers.reduce((sum, item) => sum + (item.score ?? 0), 0);
      const earnedMarks = (refreshed.earnedMarks ?? 0) + earnedWritten;
      const totalMarks = refreshed.totalMarks ?? earnedMarks;
      const score = totalMarks ? Math.round((earnedMarks / totalMarks) * 100) : 0;
      const passed = quizPassed(score, (await this.repo.findLessonContext(refreshed.lessonId))?.quiz?.passScore ?? 70);
      await this.repo.finalizeAttempt(attemptId, score, passed, earnedMarks, totalMarks);
      if (passed) {
        await this.enrollment.markLessonComplete(refreshed.userId, refreshed.lesson.section.course.id, refreshed.lessonId);
      }
    }
    return this.getSubmission(user, attemptId);
  }
}
