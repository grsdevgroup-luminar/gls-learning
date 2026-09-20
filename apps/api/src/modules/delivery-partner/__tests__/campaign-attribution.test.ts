import { describe, expect, it, vi } from "vitest";
import type { EmailService } from "../../email/email.service";
import type { NotificationsService } from "../../notifications/notifications.service";
import type { StorageDriver } from "../../storage/storage.driver";
import { DeliveryPartnerService } from "../delivery-partner.service";
import type { DeliveryPartnerRepository } from "../delivery-partner.repository";

const orderId = "order_1";
const userId = "user_1";
const now = new Date("2026-06-15T00:00:00Z");

function partner(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    referralCode: `CODE_${id}`,
    commissionPercent: 10,
    status: "APPROVED",
    ...overrides,
  };
}

function campaignRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "campaign_1",
    code: "CMP-ABC123",
    partnerId: "partner_campaign",
    discountPercent: 20,
    startDate: new Date("2026-06-01T00:00:00Z"),
    endDate: new Date("2026-06-30T00:00:00Z"),
    active: true,
    usageLimit: 0,
    usageCount: 0,
    partner: {
      ...partner("partner_campaign"),
      user: { name: "Acme Partners" },
    },
    ...overrides,
  };
}

function makeService(repoOverrides: Partial<DeliveryPartnerRepository>) {
  const baseRepo: Partial<DeliveryPartnerRepository> = {
    findOrderTotalById: vi.fn().mockResolvedValue({ totalCents: 1000 }),
    findReferralByOrderId: vi.fn().mockResolvedValue(null),
    createPendingReferralTx: vi.fn().mockResolvedValue(undefined),
    createPendingCampaignReferralTx: vi.fn().mockResolvedValue(undefined),
    findCampaignByCode: vi.fn().mockResolvedValue(null),
    findUserReferralAttribution: vi.fn().mockResolvedValue({ referredByPartnerId: null }),
    findPartnerByReferralCode: vi.fn().mockResolvedValue(null),
    ...repoOverrides,
  };
  const repo = baseRepo as unknown as DeliveryPartnerRepository;
  const notifications = {} as NotificationsService;
  const email = {} as EmailService;
  const storage = {} as StorageDriver;
  return new DeliveryPartnerService(repo, notifications, email, storage);
}

describe("DeliveryPartnerService campaign-code attribution", () => {
  it("a valid campaign code wins over durable signup-time attribution", async () => {
    vi.setSystemTime(now);
    const findCampaignByCode = vi.fn().mockResolvedValue(campaignRow());
    const findUserReferralAttribution = vi.fn().mockResolvedValue({ referredByPartnerId: "partner_signup" });
    const findPartnerById = vi.fn().mockResolvedValue(partner("partner_signup"));
    const createPendingCampaignReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findCampaignByCode,
      findUserReferralAttribution,
      findPartnerById,
      createPendingCampaignReferralTx,
    });

    await service.createPendingReferral(orderId, userId, null, "cmp-abc123");

    expect(findUserReferralAttribution).not.toHaveBeenCalled();
    expect(createPendingCampaignReferralTx).toHaveBeenCalledWith(
      "partner_campaign",
      orderId,
      100, // 10% of 1000
      "CODE_partner_campaign",
      "campaign_1",
      "CMP-ABC123",
    );
    vi.useRealTimers();
  });

  it("a valid campaign code wins over the checkout-time referralCode fallback", async () => {
    vi.setSystemTime(now);
    const findCampaignByCode = vi.fn().mockResolvedValue(campaignRow());
    const findPartnerByReferralCode = vi.fn().mockResolvedValue(partner("partner_checkout"));
    const createPendingCampaignReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findCampaignByCode,
      findPartnerByReferralCode,
      createPendingCampaignReferralTx,
    });

    await service.createPendingReferral(orderId, userId, "CODE_partner_checkout", "CMP-ABC123");

    expect(findPartnerByReferralCode).not.toHaveBeenCalled();
    expect(createPendingCampaignReferralTx).toHaveBeenCalledWith(
      "partner_campaign",
      orderId,
      100,
      "CODE_partner_campaign",
      "campaign_1",
      "CMP-ABC123",
    );
    vi.useRealTimers();
  });

  it("falls back to normal resolution when the campaign has expired", async () => {
    vi.setSystemTime(new Date("2026-07-15T00:00:00Z")); // after campaign.endDate
    const findCampaignByCode = vi.fn().mockResolvedValue(campaignRow());
    const findUserReferralAttribution = vi.fn().mockResolvedValue({ referredByPartnerId: null });
    const findPartnerByReferralCode = vi.fn().mockResolvedValue(partner("partner_checkout"));
    const createPendingReferralTx = vi.fn().mockResolvedValue(undefined);
    const createPendingCampaignReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findCampaignByCode,
      findUserReferralAttribution,
      findPartnerByReferralCode,
      createPendingReferralTx,
      createPendingCampaignReferralTx,
    });

    await service.createPendingReferral(orderId, userId, "CODE_partner_checkout", "CMP-ABC123");

    expect(createPendingCampaignReferralTx).not.toHaveBeenCalled();
    expect(createPendingReferralTx).toHaveBeenCalledWith(
      "partner_checkout",
      orderId,
      100,
      "CODE_partner_checkout",
    );
    vi.useRealTimers();
  });

  it("falls back to normal resolution when the campaign's usage limit is reached", async () => {
    vi.setSystemTime(now);
    const findCampaignByCode = vi.fn().mockResolvedValue(
      campaignRow({ usageLimit: 100, usageCount: 100 }),
    );
    const findUserReferralAttribution = vi.fn().mockResolvedValue({ referredByPartnerId: null });
    const findPartnerByReferralCode = vi.fn().mockResolvedValue(null);
    const createPendingReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findCampaignByCode,
      findUserReferralAttribution,
      findPartnerByReferralCode,
      createPendingReferralTx,
    });

    await service.createPendingReferral(orderId, userId, null, "CMP-ABC123");

    expect(createPendingReferralTx).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("falls back to normal resolution when the campaign's partner is suspended", async () => {
    vi.setSystemTime(now);
    const findCampaignByCode = vi.fn().mockResolvedValue(
      campaignRow({ partner: { ...partner("partner_campaign", { status: "SUSPENDED" }), user: { name: "Acme" } } }),
    );
    const findUserReferralAttribution = vi.fn().mockResolvedValue({ referredByPartnerId: null });
    const findPartnerByReferralCode = vi.fn().mockResolvedValue(null);
    const createPendingReferralTx = vi.fn().mockResolvedValue(undefined);
    const createPendingCampaignReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findCampaignByCode,
      findUserReferralAttribution,
      findPartnerByReferralCode,
      createPendingReferralTx,
      createPendingCampaignReferralTx,
    });

    await service.createPendingReferral(orderId, userId, null, "CMP-ABC123");

    expect(createPendingCampaignReferralTx).not.toHaveBeenCalled();
    expect(createPendingReferralTx).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("DeliveryPartnerService.evaluateCampaign", () => {
  it("computes the discount for a valid, active campaign", async () => {
    vi.setSystemTime(now);
    const findCampaignByCode = vi.fn().mockResolvedValue(campaignRow());
    const service = makeService({ findCampaignByCode });

    const { result, discountCents } = await service.evaluateCampaign("cmp-abc123", 10_000);

    expect(findCampaignByCode).toHaveBeenCalledWith("CMP-ABC123");
    expect(result.ok).toBe(true);
    expect(discountCents).toBe(2_000); // 20% of 10,000
    vi.useRealTimers();
  });

  it("rejects an unknown code", async () => {
    const findCampaignByCode = vi.fn().mockResolvedValue(null);
    const service = makeService({ findCampaignByCode });

    const { result, discountCents } = await service.evaluateCampaign("NOPE", 10_000);

    expect(result.ok).toBe(false);
    expect(discountCents).toBe(0);
  });

  it("rejects a campaign whose partner is no longer approved", async () => {
    vi.setSystemTime(now);
    const findCampaignByCode = vi.fn().mockResolvedValue(
      campaignRow({ partner: { ...partner("partner_campaign", { status: "SUSPENDED" }), user: { name: "Acme" } } }),
    );
    const service = makeService({ findCampaignByCode });

    const { result, discountCents } = await service.evaluateCampaign("CMP-ABC123", 10_000);

    expect(result.ok).toBe(false);
    expect(discountCents).toBe(0);
    vi.useRealTimers();
  });
});
