import { describe, expect, it, vi } from "vitest";
import type { EmailService } from "../../email/email.service";
import type { NotificationsService } from "../../notifications/notifications.service";
import type { StorageDriver } from "../../storage/storage.driver";
import { DeliveryPartnerService } from "../delivery-partner.service";
import type { DeliveryPartnerRepository } from "../delivery-partner.repository";

const orderId = "order_1";
const userId = "user_1";

function partner(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    referralCode: `CODE_${id}`,
    commissionPercent: 10,
    status: "APPROVED",
    ...overrides,
  };
}

function makeService(repoOverrides: Partial<DeliveryPartnerRepository>) {
  const baseRepo: Partial<DeliveryPartnerRepository> = {
    findOrderTotalById: vi.fn().mockResolvedValue({ totalCents: 1000 }),
    findReferralByOrderId: vi.fn().mockResolvedValue(null),
    createPendingReferralTx: vi.fn().mockResolvedValue(undefined),
    ...repoOverrides,
  };
  const repo = baseRepo as unknown as DeliveryPartnerRepository;
  const notifications = {} as NotificationsService;
  const email = {} as EmailService;
  const storage = {} as StorageDriver;
  return new DeliveryPartnerService(repo, notifications, email, storage);
}

describe("DeliveryPartnerService referral attribution precedence", () => {
  it("prefers durable signup-time attribution over a different checkout-time code", async () => {
    const findUserReferralAttribution = vi.fn().mockResolvedValue({ referredByPartnerId: "partner_signup" });
    const findPartnerById = vi.fn().mockResolvedValue(partner("partner_signup"));
    const findPartnerByReferralCode = vi.fn().mockResolvedValue(partner("partner_checkout"));
    const createPendingReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findUserReferralAttribution,
      findPartnerById,
      findPartnerByReferralCode,
      createPendingReferralTx,
    });

    await service.createPendingReferral(orderId, userId, "CODE_partner_checkout");

    expect(findPartnerByReferralCode).not.toHaveBeenCalled();
    expect(createPendingReferralTx).toHaveBeenCalledWith(
      "partner_signup",
      orderId,
      100, // 10% of 1000
      "CODE_partner_signup",
    );
  });

  it("falls back to the checkout-time code when there is no durable attribution", async () => {
    const findUserReferralAttribution = vi.fn().mockResolvedValue({ referredByPartnerId: null });
    const findPartnerByReferralCode = vi.fn().mockResolvedValue(partner("partner_checkout"));
    const createPendingReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findUserReferralAttribution,
      findPartnerByReferralCode,
      createPendingReferralTx,
    });

    await service.createPendingReferral(orderId, userId, "CODE_partner_checkout");

    expect(createPendingReferralTx).toHaveBeenCalledWith(
      "partner_checkout",
      orderId,
      100,
      "CODE_partner_checkout",
    );
  });

  it("falls back to the checkout-time code when the durably-attributed partner is no longer approved", async () => {
    const findUserReferralAttribution = vi.fn().mockResolvedValue({ referredByPartnerId: "partner_signup" });
    const findPartnerById = vi.fn().mockResolvedValue(partner("partner_signup", { status: "SUSPENDED" }));
    const findPartnerByReferralCode = vi.fn().mockResolvedValue(partner("partner_checkout"));
    const createPendingReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findUserReferralAttribution,
      findPartnerById,
      findPartnerByReferralCode,
      createPendingReferralTx,
    });

    await service.createPendingReferral(orderId, userId, "CODE_partner_checkout");

    expect(createPendingReferralTx).toHaveBeenCalledWith(
      "partner_checkout",
      orderId,
      100,
      "CODE_partner_checkout",
    );
  });

  it("creates no referral when neither a durable attribution nor a checkout code resolves", async () => {
    const findUserReferralAttribution = vi.fn().mockResolvedValue({ referredByPartnerId: null });
    const findPartnerByReferralCode = vi.fn().mockResolvedValue(null);
    const createPendingReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findUserReferralAttribution,
      findPartnerByReferralCode,
      createPendingReferralTx,
    });

    await service.createPendingReferral(orderId, userId, null);

    expect(createPendingReferralTx).not.toHaveBeenCalled();
  });
});
