import type { CartDto, MergeCartInput } from "@skillstream/shared";
import { apiFetch } from "./client";

export const cartApi = {
  get: () => apiFetch<CartDto>("/cart"),

  addItem: (courseId: string) =>
    apiFetch<CartDto>("/cart/items", {
      method: "POST",
      body: { courseId },
    }),

  removeItem: (courseId: string) =>
    apiFetch<CartDto>(`/cart/items/${encodeURIComponent(courseId)}`, {
      method: "DELETE",
    }),

  clear: () => apiFetch<CartDto>("/cart", { method: "DELETE" }),

  setCoupon: (couponCode: string | null) =>
    apiFetch<CartDto>("/cart/coupon", {
      method: "PATCH",
      body: { couponCode },
    }),

  merge: (input: MergeCartInput) =>
    apiFetch<CartDto>("/cart/merge", { method: "POST", body: input }),
};
