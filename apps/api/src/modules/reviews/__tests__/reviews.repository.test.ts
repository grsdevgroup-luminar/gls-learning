import { describe, expect, it, vi } from "vitest";
import { ReviewsRepository } from "../reviews.repository";

function makeRepository(insertCount: number) {
  const tx = {
    reviewHelpful: { createMany: vi.fn().mockResolvedValue({ count: insertCount }) },
    review: {
      update: vi.fn().mockResolvedValue(undefined),
      findUnique: vi.fn().mockResolvedValue({ helpful: 7 }),
    },
  };
  const prisma = {
    $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
  };
  return { repository: new ReviewsRepository(prisma as never), tx };
}

describe("ReviewsRepository.markHelpful", () => {
  it("increments the denormalized count only when a unique vote is inserted", async () => {
    const { repository, tx } = makeRepository(1);

    await expect(repository.markHelpful("review_1", "user_1")).resolves.toEqual({
      helpful: 7,
      helpfulByMe: true,
    });
    expect(tx.review.update).toHaveBeenCalledWith({
      where: { id: "review_1" },
      data: { helpful: { increment: 1 } },
    });
  });

  it("does not increment the count again when the user already voted", async () => {
    const { repository, tx } = makeRepository(0);

    await repository.markHelpful("review_1", "user_1");

    expect(tx.reviewHelpful.createMany).toHaveBeenCalledWith({
      data: [{ reviewId: "review_1", userId: "user_1" }],
      skipDuplicates: true,
    });
    expect(tx.review.update).not.toHaveBeenCalled();
  });
});
