import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CommentsService } from "../comments.service";
import type { CommentsRepository } from "../comments.repository";

function makeService(overrides: Partial<CommentsRepository> = {}) {
  const repo = {
    findCourseId: vi.fn().mockResolvedValue({ id: "course_1" }),
    listAndCountByCourse: vi.fn().mockResolvedValue([[], 0]),
    findCommentParent: vi.fn(),
    createComment: vi.fn(),
    ...overrides,
  } as unknown as CommentsRepository;
  return { service: new CommentsService(repo), repo };
}

describe("CommentsService", () => {
  it("returns top-level comments with their replies grouped under them", async () => {
    const createdAt = new Date("2026-10-06T00:00:00.000Z");
    const { service } = makeService({
      listAndCountByCourse: vi.fn().mockResolvedValue([[{
        id: "comment_1",
        courseId: "course_1",
        userId: "user_1",
        parentId: null,
        body: "Question",
        createdAt,
        user: { name: "Student", avatar: null },
        replies: [{
          id: "reply_1",
          courseId: "course_1",
          userId: "user_2",
          parentId: "comment_1",
          body: "Answer",
          createdAt,
          user: { name: "Instructor", avatar: null },
        }],
      }], 1]),
    });

    const result = await service.listForCourse("course_1", { page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0].replies).toHaveLength(1);
    expect(result.items[0].replies?.[0].body).toBe("Answer");
  });

  it("creates a reply only for a top-level comment in the same course", async () => {
    const { service, repo } = makeService({
      findCommentParent: vi.fn().mockResolvedValue({ id: "parent_1", courseId: "course_1", parentId: null }),
      createComment: vi.fn().mockResolvedValue({
        id: "reply_1", courseId: "course_1", userId: "user_1", parentId: "parent_1",
        body: "Reply", createdAt: new Date("2026-10-06T00:00:00.000Z"),
        user: { name: "Student", avatar: null }, replies: [],
      }),
    });

    const result = await service.create("user_1", "course_1", { body: "Reply", parentId: "parent_1" });

    expect(repo.createComment).toHaveBeenCalledWith("user_1", "course_1", "Reply", "parent_1");
    expect(result.parentId).toBe("parent_1");
  });

  it("rejects cross-course or nested reply targets", async () => {
    const { service } = makeService({
      findCommentParent: vi.fn().mockResolvedValue({ id: "parent_1", courseId: "other_course", parentId: null }),
    });
    await expect(service.create("user_1", "course_1", { body: "Reply", parentId: "parent_1" }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
