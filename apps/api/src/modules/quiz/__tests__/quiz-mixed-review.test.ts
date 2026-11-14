import { describe, expect, it, vi } from "vitest";
import type { RequestUser } from "../../../common/decorators/decorators";
import type { EnrollmentService } from "../../enrollment/enrollment.service";
import type { NotificationsService } from "../../notifications/notifications.service";
import { QuizService } from "../quiz.service";
import type { QuizRepository } from "../quiz.repository";

const reviewer: RequestUser = {
  id: "instructor_1",
  email: "instructor@example.com",
  role: "INSTRUCTOR",
  mustChangePassword: false,
};

function makeService(repo: Record<string, unknown>) {
  const enrollment = {
    isEnrolled: vi.fn().mockResolvedValue(true),
    assertLessonAccessible: vi.fn().mockResolvedValue(undefined),
    markLessonComplete: vi.fn().mockResolvedValue(undefined),
    getOne: vi.fn().mockResolvedValue({ progressPct: 25 }),
  };
  const notifications = {
    notify: vi.fn().mockResolvedValue(undefined),
    notifyAdmins: vi.fn().mockResolvedValue(undefined),
    notifyEmailAfterCommit: vi.fn().mockResolvedValue(undefined),
  };
  return {
    service: new QuizService(repo as unknown as QuizRepository, enrollment as unknown as EnrollmentService, notifications as unknown as NotificationsService),
    enrollment,
    notifications,
  };
}

describe("mixed quiz review", () => {
  it("returns only the student's latest reviewed written answers and feedback", async () => {
    const repo = {
      findQuizResult: vi.fn().mockResolvedValue({
        bestScore: 90,
        lastScore: 90,
        attempts: 2,
        passed: true,
        reviewStatus: "GRADED",
        lastAttemptAt: new Date("2026-11-13T09:00:00.000Z"),
      }),
      findLatestStudentAttempt: vi.fn().mockResolvedValue({
        id: "attempt_2",
        score: 90,
        passed: true,
        reviewStatus: "GRADED",
        createdAt: new Date("2026-11-13T08:00:00.000Z"),
        writtenAnswers: [{
          questionId: "written_1",
          answer: "Student's answer",
          score: 40,
          feedback: "Good explanation",
          question: { prompt: "Explain why", marks: 50, order: 1 },
        }],
      }),
    };
    const { service } = makeService(repo);

    const result = await service.getResult("student_1", "lesson_1");

    expect(repo.findLatestStudentAttempt).toHaveBeenCalledWith("student_1", "lesson_1");
    expect(result?.latestAttempt).toMatchObject({
      id: "attempt_2",
      reviewStatus: "GRADED",
      writtenReviews: [{ questionId: "written_1", score: 40, feedback: "Good explanation" }],
    });
  });

  it("keeps a mixed submission pending and excludes its provisional score from best score", async () => {
    const repo = {
      findLessonContext: vi.fn().mockResolvedValue({
        title: "Final quiz",
        section: { courseId: "course_1" },
        quiz: {
          passScore: 70,
          questions: [
            { id: "mcq_1", questionType: "MCQ", marks: 50, options: [{ id: "option_1", isCorrect: true }] },
            { id: "written_1", questionType: "WRITTEN", marks: 50, options: [] },
          ],
        },
      }),
      findQuizResult: vi.fn().mockResolvedValue(null),
      findCourseReviewerContext: vi.fn().mockResolvedValue({
        id: "course_1", title: "Course", instructorId: reviewer.id, instructor: { role: "INSTRUCTOR" },
      }),
      saveAttempt: vi.fn(async (...args: unknown[]) => {
        const onCreated = args[8] as (attemptId: string, tx: object) => Promise<void>;
        await onCreated("attempt_1", {});
        return { id: "attempt_1" };
      }),
    };
    const { service, enrollment, notifications } = makeService(repo);

    const result = await service.submitAttempt("student_1", "lesson_1", {
      answers: [
        { questionId: "mcq_1", optionIds: ["option_1"] },
        { questionId: "written_1", writtenAnswer: "My explanation" },
      ],
    });

    expect(result).toMatchObject({ attemptId: "attempt_1", reviewStatus: "PENDING_REVIEW", score: 50, bestScore: 0, passed: false });
    expect(result.results[1]).toMatchObject({ questionType: "WRITTEN", pendingReview: true });
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      "student_1", "lesson_1", 50, false, 0, 1, false,
      expect.objectContaining({ reviewStatus: "PENDING_REVIEW", earnedMarks: 50, totalMarks: 100 }),
      expect.any(Function),
    );
    expect(enrollment.markLessonComplete).not.toHaveBeenCalled();
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: reviewer.id,
      event: "QUIZ_REVIEW_REQUESTED",
      href: "/instructor/quiz-submissions/attempt_1",
      skipEmail: true,
    }), {});
    expect(notifications.notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({
      event: "QUIZ_REVIEW_REQUESTED",
      href: "/admin/quiz-submissions/attempt_1",
      skipEmail: true,
    }), {});
    expect(notifications.notifyEmailAfterCommit).not.toHaveBeenCalled();
  });

  it("notifies an admin-owned course once through the admin feed", async () => {
    const repo = {
      findLessonContext: vi.fn().mockResolvedValue({
        title: "Exam", section: { courseId: "course_1" },
        quiz: { passScore: 70, questions: [{ id: "written_1", questionType: "WRITTEN", marks: 10, options: [] }] },
      }),
      findQuizResult: vi.fn().mockResolvedValue(null),
      findCourseReviewerContext: vi.fn().mockResolvedValue({
        id: "course_1", title: "Course", instructorId: "admin_1", instructor: { role: "ADMIN" },
      }),
      saveAttempt: vi.fn(async (...args: unknown[]) => {
        await (args[8] as (id: string, tx: object) => Promise<void>)("attempt_2", {});
        return { id: "attempt_2" };
      }),
    };
    const { service, notifications } = makeService(repo);

    await service.submitAttempt("student_1", "lesson_1", {
      answers: [{ questionId: "written_1", writtenAnswer: "Answer" }],
    });

    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.notifyAdmins).toHaveBeenCalledOnce();
  });

  it("does not request manual review for an MCQ-only attempt", async () => {
    const repo = {
      findLessonContext: vi.fn().mockResolvedValue({
        title: "MCQ quiz", section: { courseId: "course_1" },
        quiz: { passScore: 70, questions: [{ id: "mcq_1", questionType: "MCQ", marks: 10, options: [{ id: "o1", isCorrect: true }] }] },
      }),
      findQuizResult: vi.fn().mockResolvedValue(null),
      saveAttempt: vi.fn().mockResolvedValue({ id: "attempt_3" }),
    };
    const { service, notifications } = makeService(repo);

    await service.submitAttempt("student_1", "lesson_1", {
      answers: [{ questionId: "mcq_1", optionIds: ["o1"] }],
    });

    expect(repo.saveAttempt).toHaveBeenCalledWith(
      "student_1", "lesson_1", expect.any(Number), true,
      expect.any(Number), 1, false, expect.any(Object), undefined,
    );
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.notifyAdmins).not.toHaveBeenCalled();
  });

  it("recalculates a revised written grade without counting the old grade twice", async () => {
    const row = {
      lessonId: "lesson_1",
      userId: "student_1",
      earnedMarks: 80,
      totalMarks: 100,
      reviewStatus: "GRADED",
      lesson: { section: { course: { id: "course_1" } } },
      writtenAnswers: [{ id: "answer_1", question: { marks: 50 }, score: 30 }],
    };
    const repo = {
      withLockedAttempt: vi.fn((_id, work) => work({})),
      findQuizSubmission: vi.fn().mockResolvedValueOnce(row).mockResolvedValueOnce(row).mockResolvedValueOnce({
        ...row,
        writtenAnswers: [{ ...row.writtenAnswers[0], score: 40 }],
      }),
      findCourseReviewerContext: vi.fn().mockResolvedValue({ id: "course_1", instructorId: reviewer.id }),
      gradeWrittenAnswer: vi.fn().mockResolvedValue(undefined),
      findLessonContext: vi.fn().mockResolvedValue({ quiz: { passScore: 70 } }),
      finalizeAttempt: vi.fn().mockResolvedValue(undefined),
    };
    const { service, enrollment, notifications } = makeService(repo);
    vi.spyOn(service, "getSubmission").mockResolvedValue({} as never);

    await service.gradeWrittenAnswer(reviewer, "attempt_1", "answer_1", { score: 40 });

    expect(repo.finalizeAttempt).toHaveBeenCalledWith("attempt_1", 90, true, 90, 100, {});
    expect(enrollment.markLessonComplete).toHaveBeenCalledWith("student_1", "course_1", "lesson_1");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.notifyEmailAfterCommit).not.toHaveBeenCalled();
  });

  it("notifies only when the last written answer completes the review", async () => {
    const base = {
      lessonId: "lesson_1", userId: "student_1", earnedMarks: 50, totalMarks: 100,
      reviewStatus: "PENDING_REVIEW" as const,
      lesson: { title: "Final quiz", section: { course: { id: "course_1", title: "Intro to React", slug: "intro-to-react" } } },
    };
    const pending = { ...base, writtenAnswers: [
      { id: "answer_1", question: { marks: 25 }, score: null },
      { id: "answer_2", question: { marks: 25 }, score: null },
    ] };
    const partial = { ...base, writtenAnswers: [
      { ...pending.writtenAnswers[0], score: 20 }, pending.writtenAnswers[1],
    ] };
    const complete = { ...base, writtenAnswers: [
      partial.writtenAnswers[0], { ...pending.writtenAnswers[1], score: 25 },
    ] };
    const repo = {
      withLockedAttempt: vi.fn((_id, work) => work({})),
      findQuizSubmission: vi.fn()
        .mockResolvedValueOnce(pending).mockResolvedValueOnce(pending).mockResolvedValueOnce(partial)
        .mockResolvedValueOnce(partial).mockResolvedValueOnce(partial).mockResolvedValueOnce(complete),
      findCourseReviewerContext: vi.fn().mockResolvedValue({ id: "course_1", instructorId: reviewer.id }),
      gradeWrittenAnswer: vi.fn().mockResolvedValue(undefined),
      findLessonContext: vi.fn().mockResolvedValue({ quiz: { passScore: 70 } }),
      finalizeAttempt: vi.fn().mockResolvedValue(undefined),
    };
    const { service, enrollment, notifications } = makeService(repo);
    vi.spyOn(service, "getSubmission").mockResolvedValue({} as never);

    await service.gradeWrittenAnswer(reviewer, "attempt_1", "answer_1", { score: 20 });
    expect(repo.finalizeAttempt).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();

    await service.gradeWrittenAnswer(reviewer, "attempt_1", "answer_2", { score: 25 });
    expect(repo.finalizeAttempt).toHaveBeenCalledWith("attempt_1", 95, true, 95, 100, {});
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: "student_1", event: "QUIZ_REVIEW_COMPLETED",
      href: "/learn/intro-to-react?lesson=lesson_1",
    }), {});
    expect(notifications.notifyEmailAfterCommit).toHaveBeenCalledTimes(1);
    expect(enrollment.markLessonComplete).toHaveBeenCalledTimes(1);
  });

  it("keeps the completed review when email queueing fails", async () => {
    const row = {
      lessonId: "lesson_1", userId: "student_1", earnedMarks: 0, totalMarks: 20,
      reviewStatus: "PENDING_REVIEW",
      lesson: { title: "Written quiz", section: { course: { id: "course_1", title: "Course", slug: "course" } } },
      writtenAnswers: [{ id: "answer_1", question: { marks: 20 }, score: null }],
    };
    const repo = {
      withLockedAttempt: vi.fn((_id, work) => work({})),
      findQuizSubmission: vi.fn().mockResolvedValueOnce(row).mockResolvedValueOnce(row)
        .mockResolvedValueOnce({ ...row, writtenAnswers: [{ ...row.writtenAnswers[0], score: 10 }] }),
      findCourseReviewerContext: vi.fn().mockResolvedValue({ id: "course_1", instructorId: reviewer.id }),
      gradeWrittenAnswer: vi.fn().mockResolvedValue(undefined),
      findLessonContext: vi.fn().mockResolvedValue({ quiz: { passScore: 70 } }),
      finalizeAttempt: vi.fn().mockResolvedValue(undefined),
    };
    const { service, notifications } = makeService(repo);
    notifications.notifyEmailAfterCommit.mockRejectedValueOnce(new Error("Redis unavailable"));
    vi.spyOn(service, "getSubmission").mockResolvedValue({} as never);

    await expect(service.gradeWrittenAnswer(reviewer, "attempt_1", "answer_1", { score: 10 }))
      .resolves.toEqual({});
    expect(repo.finalizeAttempt).toHaveBeenCalledOnce();
    expect(notifications.notify).toHaveBeenCalledOnce();
  });
});
