import { describe, expect, it, vi } from "vitest";
import type { RequestUser } from "../../../common/decorators/decorators";
import type { EnrollmentService } from "../../enrollment/enrollment.service";
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
  };
  return {
    service: new QuizService(repo as QuizRepository, enrollment as unknown as EnrollmentService),
    enrollment,
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
      saveAttempt: vi.fn().mockResolvedValue({ id: "attempt_1" }),
    };
    const { service, enrollment } = makeService(repo);

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
    );
    expect(enrollment.markLessonComplete).not.toHaveBeenCalled();
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
      findQuizSubmission: vi.fn().mockResolvedValueOnce(row).mockResolvedValueOnce({
        ...row,
        writtenAnswers: [{ ...row.writtenAnswers[0], score: 40 }],
      }),
      findCourseReviewerContext: vi.fn().mockResolvedValue({ id: "course_1", instructorId: reviewer.id }),
      gradeWrittenAnswer: vi.fn().mockResolvedValue(undefined),
      findLessonContext: vi.fn().mockResolvedValue({ quiz: { passScore: 70 } }),
      finalizeAttempt: vi.fn().mockResolvedValue(undefined),
    };
    const { service, enrollment } = makeService(repo);
    vi.spyOn(service, "getSubmission").mockResolvedValue({} as never);

    await service.gradeWrittenAnswer(reviewer, "attempt_1", "answer_1", { score: 40 });

    expect(repo.finalizeAttempt).toHaveBeenCalledWith("attempt_1", 90, true, 90, 100);
    expect(enrollment.markLessonComplete).toHaveBeenCalledWith("student_1", "course_1", "lesson_1");
  });
});
