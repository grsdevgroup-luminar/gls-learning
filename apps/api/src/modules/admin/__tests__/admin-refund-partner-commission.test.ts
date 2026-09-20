import { describe, expect, it, vi } from "vitest";
import type { AdminRepository } from "../admin.repository";
import type { CreditsService } from "../../credits/credits.service";
import type { NotificationsService } from "../../notifications/notifications.service";
import { AdminService } from "../admin.service";

const orderId = "order_1";
const partnerId = "partner_1";
const adminUserId = "admin_1";

/** A single-item, $10 order — matches the shape `loadRefundableOrder` /
 *  `buildRefundPlan` / `toOrderDto` all read from. */
function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: orderId,
    userId: "student_1",
    status: "PAID",
    gateway: "stripe",
    subtotalCents: 1000,
    discountCents: 0,
    creditAppliedCents: 0,
    totalCents: 1000,
    currency: "USD",
    couponCode: null,
    refundedCents: 0,
    createdAt: new Date(),
    items: [
      {
        id: "item_1",
        courseId: "course_1",
        titleSnapshot: "Course",
        priceCents: 1000,
        refundedCents: 0,
      },
    ],
    ...overrides,
  };
}

function makeService(repoOverrides: Partial<AdminRepository>) {
  const baseRepo: Partial<AdminRepository> = {
    runTransaction: vi.fn((fn: (tx: never) => unknown) => fn({} as never)) as AdminRepository["runTransaction"],
    incrementOrderItemRefunded: vi.fn().mockResolvedValue(undefined),
    decrementCourseOnRefund: vi.fn().mockResolvedValue({ instructorId: "instr_1" }),
    decrementInstructorOnRefund: vi.fn().mockResolvedValue(undefined),
    updateOrderRefundState: vi.fn().mockResolvedValue(undefined),
    decrementStudentTotalSpent: vi.fn().mockResolvedValue(undefined),
    deleteEnrollmentsForRefund: vi.fn().mockResolvedValue(undefined),
    reverseReferralEarnings: vi.fn().mockResolvedValue(undefined),
    updateReferralReversal: vi.fn().mockResolvedValue(undefined),
    findOrderWithItemsOrThrow: vi.fn().mockResolvedValue(makeOrder()),
    ...repoOverrides,
  };
  const repo = baseRepo as unknown as AdminRepository;
  const credits = { grantRefund: vi.fn().mockResolvedValue(undefined) } as unknown as CreditsService;
  const notifications = {
    notify: vi.fn().mockResolvedValue(undefined),
    notifyEmailAfterCommit: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;
  return new AdminService(repo, credits, notifications);
}

describe("AdminService refund → delivery-partner commission reversal", () => {
  it("partially reverses a CONFIRMED commission proportionally to the refund amount", async () => {
    const findOrderWithItems = vi.fn().mockResolvedValue(makeOrder());
    const findReferralForOrder = vi.fn().mockResolvedValue({
      id: "referral_1",
      partnerId,
      commissionCents: 100,
      reversedCents: 0,
      status: "CONFIRMED",
    });
    const reverseReferralEarnings = vi.fn().mockResolvedValue(undefined);
    const updateReferralReversal = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findOrderWithItems,
      findReferralForOrder,
      reverseReferralEarnings,
      updateReferralReversal,
    });

    // Refund half the order ($5 of $10) — commission should reverse by 50%.
    await service.refundOrder(
      orderId,
      { comment: "duplicate charge", items: [{ orderItemId: "item_1", amountCents: 500 }] },
      adminUserId,
    );

    expect(reverseReferralEarnings).toHaveBeenCalledWith(partnerId, 50, false, expect.anything());
    expect(updateReferralReversal).toHaveBeenCalledWith("referral_1", 50, "CONFIRMED", expect.anything());
  });

  it("fully reverses a CONFIRMED commission and flips it to REVERSED once the whole order is refunded", async () => {
    const findOrderWithItems = vi.fn().mockResolvedValue(makeOrder());
    const findReferralForOrder = vi.fn().mockResolvedValue({
      id: "referral_1",
      partnerId,
      commissionCents: 100,
      reversedCents: 0,
      status: "CONFIRMED",
    });
    const reverseReferralEarnings = vi.fn().mockResolvedValue(undefined);
    const updateReferralReversal = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findOrderWithItems,
      findReferralForOrder,
      reverseReferralEarnings,
      updateReferralReversal,
    });

    await service.refundOrder(
      orderId,
      { comment: "full refund", items: [{ orderItemId: "item_1", amountCents: 1000 }] },
      adminUserId,
    );

    expect(reverseReferralEarnings).toHaveBeenCalledWith(partnerId, 100, false, expect.anything());
    expect(updateReferralReversal).toHaveBeenCalledWith("referral_1", 100, "REVERSED", expect.anything());
  });

  it("claws back a PAID commission from totalEarningsCents only, leaving paidEarningsCents untouched", async () => {
    const findOrderWithItems = vi.fn().mockResolvedValue(makeOrder());
    const findReferralForOrder = vi.fn().mockResolvedValue({
      id: "referral_1",
      partnerId,
      commissionCents: 100,
      reversedCents: 0,
      status: "PAID",
    });
    const reverseReferralEarnings = vi.fn().mockResolvedValue(undefined);
    const updateReferralReversal = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findOrderWithItems,
      findReferralForOrder,
      reverseReferralEarnings,
      updateReferralReversal,
    });

    await service.refundOrder(
      orderId,
      { comment: "refund after payout", items: [{ orderItemId: "item_1", amountCents: 1000 }] },
      adminUserId,
    );

    // wasPaidOut=true — the repository only decrements totalEarningsCents for
    // a PAID referral, never paidEarningsCents (see reverseReferralEarnings).
    expect(reverseReferralEarnings).toHaveBeenCalledWith(partnerId, 100, true, expect.anything());
    expect(updateReferralReversal).toHaveBeenCalledWith("referral_1", 100, "REVERSED", expect.anything());
  });

  it("caps cumulative reversal at the original commission across repeated partial refunds", async () => {
    const findOrderWithItems = vi.fn().mockResolvedValue(makeOrder());
    // 70 of the 100 cents already reversed by an earlier refund action.
    const findReferralForOrder = vi.fn().mockResolvedValue({
      id: "referral_1",
      partnerId,
      commissionCents: 100,
      reversedCents: 70,
      status: "CONFIRMED",
    });
    const reverseReferralEarnings = vi.fn().mockResolvedValue(undefined);
    const updateReferralReversal = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findOrderWithItems,
      findReferralForOrder,
      reverseReferralEarnings,
      updateReferralReversal,
    });

    // This refund's proportional share would be 50, but only 30 remains.
    await service.refundOrder(
      orderId,
      { comment: "second partial refund", items: [{ orderItemId: "item_1", amountCents: 500 }] },
      adminUserId,
    );

    expect(reverseReferralEarnings).toHaveBeenCalledWith(partnerId, 30, false, expect.anything());
    expect(updateReferralReversal).toHaveBeenCalledWith("referral_1", 100, "REVERSED", expect.anything());
  });

  it("closes out a still-PENDING referral with no earnings impact", async () => {
    const findOrderWithItems = vi.fn().mockResolvedValue(makeOrder());
    const findReferralForOrder = vi.fn().mockResolvedValue({
      id: "referral_1",
      partnerId,
      commissionCents: 100,
      reversedCents: 0,
      status: "PENDING",
    });
    const reverseReferralEarnings = vi.fn().mockResolvedValue(undefined);
    const updateReferralReversal = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findOrderWithItems,
      findReferralForOrder,
      reverseReferralEarnings,
      updateReferralReversal,
    });

    await service.refundOrder(
      orderId,
      { comment: "refund before confirmation", items: [{ orderItemId: "item_1", amountCents: 1000 }] },
      adminUserId,
    );

    expect(reverseReferralEarnings).not.toHaveBeenCalled();
    expect(updateReferralReversal).toHaveBeenCalledWith("referral_1", 0, "REVERSED", expect.anything());
  });

  it("is a no-op when the order was never attributed to a partner", async () => {
    const findOrderWithItems = vi.fn().mockResolvedValue(makeOrder());
    const findReferralForOrder = vi.fn().mockResolvedValue(null);
    const reverseReferralEarnings = vi.fn().mockResolvedValue(undefined);
    const updateReferralReversal = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findOrderWithItems,
      findReferralForOrder,
      reverseReferralEarnings,
      updateReferralReversal,
    });

    await service.refundOrder(
      orderId,
      { comment: "no partner involved", items: [{ orderItemId: "item_1", amountCents: 1000 }] },
      adminUserId,
    );

    expect(reverseReferralEarnings).not.toHaveBeenCalled();
    expect(updateReferralReversal).not.toHaveBeenCalled();
  });

  it("is a no-op when the commission is already fully reversed", async () => {
    const findOrderWithItems = vi.fn().mockResolvedValue(makeOrder());
    const findReferralForOrder = vi.fn().mockResolvedValue({
      id: "referral_1",
      partnerId,
      commissionCents: 100,
      reversedCents: 100,
      status: "REVERSED",
    });
    const reverseReferralEarnings = vi.fn().mockResolvedValue(undefined);
    const updateReferralReversal = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findOrderWithItems,
      findReferralForOrder,
      reverseReferralEarnings,
      updateReferralReversal,
    });

    await service.refundOrder(
      orderId,
      { comment: "already reversed", items: [{ orderItemId: "item_1", amountCents: 200 }] },
      adminUserId,
    );

    expect(reverseReferralEarnings).not.toHaveBeenCalled();
    expect(updateReferralReversal).not.toHaveBeenCalled();
  });
});
