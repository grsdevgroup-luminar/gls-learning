import { z } from "zod";

export const addCartItemSchema = z.object({
  courseId: z.string().min(1),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

/** One discount/referral code field — the server resolves whether it's a
 *  Coupon or a DeliveryPartnerCampaign code (see CodeResolverService) and
 *  stores it in the matching (mutually exclusive) cart column. */
export const setCartCodeSchema = z.object({
  code: z.string().trim().nullable(),
});
export type SetCartCodeInput = z.infer<typeof setCartCodeSchema>;

export const mergeCartSchema = z.object({
  courseIds: z.array(z.string().min(1)).default([]),
  code: z.string().trim().nullable().optional(),
});
export type MergeCartInput = z.infer<typeof mergeCartSchema>;

export interface CartItemDto {
  courseId: string;
  addedAt: string;
}

export interface CartDto {
  items: CartItemDto[];
  /** Whichever of the cart's (mutually exclusive) coupon/campaign columns is
   *  set — the frontend no longer needs to know which type it resolved to
   *  until it re-quotes (see QuoteDto.appliedCode). */
  code: string | null;
  updatedAt: string;
}
