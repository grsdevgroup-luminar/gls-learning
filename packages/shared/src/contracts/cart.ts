import { z } from "zod";

export const addCartItemSchema = z.object({
  courseId: z.string().min(1),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const setCartCouponSchema = z.object({
  couponCode: z.string().trim().nullable(),
});
export type SetCartCouponInput = z.infer<typeof setCartCouponSchema>;

export const mergeCartSchema = z.object({
  courseIds: z.array(z.string().min(1)).default([]),
  couponCode: z.string().trim().nullable().optional(),
});
export type MergeCartInput = z.infer<typeof mergeCartSchema>;

export interface CartItemDto {
  courseId: string;
  addedAt: string;
}

export interface CartDto {
  items: CartItemDto[];
  couponCode: string | null;
  updatedAt: string;
}
