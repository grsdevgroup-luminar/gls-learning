// ---------------------------------------------------------------------------
// Delivery-partner campaign validation + discount math. Pure and shared, same
// split as coupon.ts: the API uses it as the authoritative calculation at
// checkout, the frontend uses it for live preview/status badges.
// All money in integer cents.
// ---------------------------------------------------------------------------

import type { DeliveryPartnerCampaignScope } from "./enums.js";

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
  scope: DeliveryPartnerCampaignScope;
  /** Course ids this campaign applies to — only meaningful when scope is
   *  SPECIFIC; empty/ignored when GLOBAL. */
  courseIds: string[];
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

/** Validate a campaign code against the cart's course ids. `now` is injected
 *  so the API (real clock) and tests (fixed clock) agree.
 *
 *  Unlike Coupon's course scope (all-or-nothing — a mismatched course rejects
 *  the whole code), a SPECIFIC campaign with only a *partial* overlap still
 *  validates: the code applies, just only to the eligible lines. The caller
 *  computes eligibility (see eligibleCampaignCourseIds) and only rejects
 *  outright when there's no overlap at all. */
export function validatePartnerCampaign(
  campaign: PartnerCampaignLike | undefined | null,
  cartCourseIds: string[] = [],
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
  if (
    campaign.scope === "SPECIFIC" &&
    !cartCourseIds.some((id) => campaign.courseIds.includes(id))
  )
    return { ok: false, message: "This referral code doesn't apply to any course in your cart." };
  return {
    ok: true,
    message: `${campaign.discountPercent}% off, courtesy of ${campaign.partnerName}`,
    campaign,
  };
}

/** The cart course ids this campaign's discount actually covers — every
 *  course id when GLOBAL, the intersecting subset when SPECIFIC. */
export function eligibleCampaignCourseIds(
  campaign: PartnerCampaignLike,
  cartCourseIds: string[],
): string[] {
  return campaign.scope === "SPECIFIC"
    ? cartCourseIds.filter((id) => campaign.courseIds.includes(id))
    : cartCourseIds;
}

/** Discount amount in cents, never exceeding the eligible subtotal (percent
 *  is bounded 0-100 at input validation, so this is a formality, not a clamp
 *  that ever actually triggers). Pass only the eligible lines' subtotal —
 *  GLOBAL means every line is eligible, SPECIFIC means only the overlapping
 *  ones (see eligibleCampaignCourseIds). */
export function partnerCampaignDiscountCents(
  campaign: PartnerCampaignLike,
  eligibleSubtotalCents: number,
): number {
  return Math.min(
    eligibleSubtotalCents,
    Math.round(eligibleSubtotalCents * (campaign.discountPercent / 100)),
  );
}
