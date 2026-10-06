import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ReviewsService } from "../reviews.service";
import type { ReviewsRepository } from "../reviews.repository";

function makeService(overrides: Partial<ReviewsRepository> = {}) {
  const repo = {
    findHelpfulVoteContext: vi.fn(),
    markHelpful: vi.fn(),
    ...overrides,
  } as unknown as ReviewsRepository;
  const service = new ReviewsService(repo, {} as never, {} as never, {} as never);
  return { service, repo };
}

describe("ReviewsService.markHelpful", () => {
  it("returns the persisted helpful count for an approved review", async () => {
    const { service, repo } = makeService({
      findHelpfulVoteContext: vi.fn().mockResolvedValue({ id: "review_1", status: "APPROVED", userId: "author_1" }),
      markHelpful: vi.fn().mockResolvedValue({ helpful: 4, helpfulByMe: true }),
    });

    await expect(service.markHelpful("review_1", "viewer_1")).resolves.toEqual({
      helpful: 4,
      helpfulByMe: true,
    });
    expect(repo.markHelpful).toHaveBeenCalledWith("review_1", "viewer_1");
  });

  it("does not allow an author to vote for their own review", async () => {
    const { service, repo } = makeService({
      findHelpfulVoteContext: vi.fn().mockResolvedValue({ id: "review_1", status: "APPROVED", userId: "author_1" }),
    });
    await expect(service.markHelpful("review_1", "author_1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.markHelpful).not.toHaveBeenCalled();
  });

  it("only accepts approved reviews", async () => {
    const { service } = makeService({
      findHelpfulVoteContext: vi.fn().mockResolvedValue({ id: "review_1", status: "PENDING", userId: "author_1" }),
    });
    await expect(service.markHelpful("review_1", "viewer_1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
