// ---------------------------------------------------------------------------
// Delivery-partner campaign validation + discount math. Pure and shared, same
// split as coupon.ts: the API uses it as the authoritative calculation at
// checkout, the frontend uses it for live preview/status badges.
// All money in integer cents.
// ---------------------------------------------------------------------------

export interface PartnerCampaignLike {
  code: string;
  partnerName: string;
  discountPercent: number; // 0-100
  startDate: string | Date;
  endDate: string | Date;
  active: boolean;
  usageLimit: number; // 0 = unlimited
  usageCount: number;
  /** The owning partner must be APPROVED for the code to work — a suspended
   *  partner's campaign stops working immediately, same as their other
   *  self-service actions (DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §11.2). */
  partnerApproved: boolean;
}

export type PartnerCampaignStatus =
  | "disabled"
  | "scheduled"
  | "expired"
  | "limit-reached"
  | "active";

/** Only the fields status derivation actually needs — callers that don't
 *  have (or care about) partnerName/partnerApproved, e.g. an admin listing
 *  a partner's own campaigns, shouldn't have to fabricate them. */
export type PartnerCampaignStatusInput = Pick<
  PartnerCampaignLike,
  "active" | "startDate" | "endDate" | "usageLimit" | "usageCount"
>;

/** Derived lifecycle status for admin/partner UIs. Order matters, same as
 *  couponStatus: an admin-disabled campaign reads "disabled" even if it's
 *  also outside its date window. */
export function campaignStatus(
  campaign: PartnerCampaignStatusInput,
  now: Date = new Date(),
): PartnerCampaignStatus {
  if (!campaign.active) return "disabled";
  if (now < new Date(campaign.startDate)) return "scheduled";
  if (now > new Date(campaign.endDate)) return "expired";
  if (campaign.usageLimit > 0 && campaign.usageCount >= campaign.usageLimit)
    return "limit-reached";
  return "active";
}

export interface PartnerCampaignResult {
  ok: boolean;
  message: string;
  campaign?: PartnerCampaignLike;
}

/** Validate a campaign code against a cart subtotal (cents). Unlike Coupon,
 *  a campaign is always GLOBAL (applicable to all courses) — no course-scope
 *  check needed. `now` is injected so the API (real clock) and tests (fixed
 *  clock) agree. */
export function validatePartnerCampaign(
  campaign: PartnerCampaignLike | undefined | null,
  now: Date = new Date(),
): PartnerCampaignResult {
  if (!campaign) return { ok: false, message: "That referral code isn't valid." };
  if (!campaign.partnerApproved)
    return { ok: false, message: "This referral code is no longer active." };
  const status = campaignStatus(campaign, now);
  if (status === "disabled" || status === "expired")
    return { ok: false, message: "This referral code has expired." };
  if (status === "scheduled")
    return { ok: false, message: "This referral code isn't active yet." };
  if (status === "limit-reached")
    return { ok: false, message: "This referral code has reached its usage limit." };
  return {
    ok: true,
    message: `${campaign.discountPercent}% off, courtesy of ${campaign.partnerName}`,
    campaign,
  };
}

/** Discount amount in cents, never exceeding the subtotal (percent is
 *  bounded 0-100 at input validation, so this is a formality, not a clamp
 *  that ever actually triggers). */
export function partnerCampaignDiscountCents(
  campaign: PartnerCampaignLike,
  subtotalCents: number,
): number {
  return Math.min(
    subtotalCents,
    Math.round(subtotalCents * (campaign.discountPercent / 100)),
  );
}
