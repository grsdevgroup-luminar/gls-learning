import { describe, expect, it, vi } from "vitest";
import type { EmailService } from "../../email/email.service";
import type { NotificationsService } from "../../notifications/notifications.service";
import type { StorageDriver } from "../../storage/storage.driver";
import { DeliveryPartnerService } from "../delivery-partner.service";
import type { DeliveryPartnerRepository } from "../delivery-partner.repository";

const orderId = "order_1";
const now = new Date("2026-06-15T00:00:00Z");

function partner(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
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
    findCampaignByCode: vi.fn().mockResolvedValue(null),
    ...repoOverrides,
  };
  const repo = baseRepo as unknown as DeliveryPartnerRepository;
  const notifications = {} as NotificationsService;
  const email = {} as EmailService;
  const storage = {} as StorageDriver;
  return new DeliveryPartnerService(repo, notifications, email, storage);
}

describe("DeliveryPartnerService campaign-code attribution", () => {
  it("a valid campaign code attributes and credits commission", async () => {
    vi.setSystemTime(now);
    const findCampaignByCode = vi.fn().mockResolvedValue(campaignRow());
    const createPendingReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({ findCampaignByCode, createPendingReferralTx });

    await service.createPendingReferral(orderId, "cmp-abc123");

    expect(findCampaignByCode).toHaveBeenCalledWith("CMP-ABC123");
    expect(createPendingReferralTx).toHaveBeenCalledWith(
      "partner_campaign",
      orderId,
      100, // 10% of 1000
      "campaign_1",
      "CMP-ABC123",
    );
    vi.useRealTimers();
  });

  it("no code at all creates no referral", async () => {
    const createPendingReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({ createPendingReferralTx });

    await service.createPendingReferral(orderId, null);

    expect(createPendingReferralTx).not.toHaveBeenCalled();
  });

  it("an expired campaign creates no referral", async () => {
    vi.setSystemTime(new Date("2026-07-15T00:00:00Z")); // after campaign.endDate
    const findCampaignByCode = vi.fn().mockResolvedValue(campaignRow());
    const createPendingReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({ findCampaignByCode, createPendingReferralTx });

    await service.createPendingReferral(orderId, "CMP-ABC123");

    expect(createPendingReferralTx).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("a limit-reached campaign creates no referral", async () => {
    vi.setSystemTime(now);
    const findCampaignByCode = vi.fn().mockResolvedValue(
      campaignRow({ usageLimit: 100, usageCount: 100 }),
    );
    const createPendingReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({ findCampaignByCode, createPendingReferralTx });

    await service.createPendingReferral(orderId, "CMP-ABC123");

    expect(createPendingReferralTx).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("a campaign whose partner is suspended creates no referral", async () => {
    vi.setSystemTime(now);
    const findCampaignByCode = vi.fn().mockResolvedValue(
      campaignRow({ partner: { ...partner("partner_campaign", { status: "SUSPENDED" }), user: { name: "Acme" } } }),
    );
    const createPendingReferralTx = vi.fn().mockResolvedValue(undefined);
    const service = makeService({ findCampaignByCode, createPendingReferralTx });

    await service.createPendingReferral(orderId, "CMP-ABC123");

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
