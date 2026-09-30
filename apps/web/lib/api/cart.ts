import type { CartDto, MergeCartInput } from "@grslearning/shared";
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

  setCode: (code: string | null) =>
    apiFetch<CartDto>("/cart/code", {
      method: "PATCH",
      body: { code },
    }),

  merge: (input: MergeCartInput) =>
    apiFetch<CartDto>("/cart/merge", { method: "POST", body: input }),
};
