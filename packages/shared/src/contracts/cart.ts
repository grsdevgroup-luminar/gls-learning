import { z } from "zod";

export const addCartItemSchema = z.object({
  courseId: z.string().min(1),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const setCartCouponSchema = z.object({
  couponCode: z.string().trim().nullable(),
});
export type SetCartCouponInput = z.infer<typeof setCartCouponSchema>;

/** Mutually exclusive with the coupon — setting a campaign code is expected
 *  to accompany clearing couponCode client-side (and vice versa); the server
 *  re-validates this at quote time regardless (see CheckoutService.quote). */
export const setCartCampaignSchema = z.object({
  campaignCode: z.string().trim().nullable(),
});
export type SetCartCampaignInput = z.infer<typeof setCartCampaignSchema>;

export const mergeCartSchema = z.object({
  courseIds: z.array(z.string().min(1)).default([]),
  couponCode: z.string().trim().nullable().optional(),
  campaignCode: z.string().trim().nullable().optional(),
});
export type MergeCartInput = z.infer<typeof mergeCartSchema>;

export interface CartItemDto {
  courseId: string;
  addedAt: string;
}

export interface CartDto {
  items: CartItemDto[];
  couponCode: string | null;
  campaignCode: string | null;
  updatedAt: string;
}
