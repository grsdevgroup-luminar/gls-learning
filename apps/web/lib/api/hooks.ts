"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  CheckoutQuoteInput,
  CreateReviewInput,
  QuizAttemptInput,
} from "@skillstream/shared";
import { api } from "./endpoints";

// Query keys
export const qk = {
  courses: (params?: unknown) => ["courses", params] as const,
  course: (slug: string) => ["course", slug] as const,
  enrollments: ["enrollments"] as const,
  progress: (courseId: string) => ["progress", courseId] as const,
  quiz: (lessonId: string) => ["quiz", lessonId] as const,
  quizResult: (lessonId: string) => ["quiz-result", lessonId] as const,
  orders: ["orders"] as const,
  reviews: (courseId: string) => ["reviews", courseId] as const,
  myReview: (courseId: string) => ["my-review", courseId] as const,
  certificates: ["certificates"] as const,
  adminOverview: ["admin-overview"] as const,
  adminStudents: (params?: unknown) => ["admin-students", params] as const,
  adminOrders: (params?: unknown) => ["admin-orders", params] as const,
  instructorProfile: ["instructor-profile"] as const,
  instructorCourses: ["instructor-courses"] as const,
  salesAgents: ["sales-agents"] as const,
};

// ── catalog ──────────────────────────────────────────────────────────────
export const useCourses = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: qk.courses(params), queryFn: () => api.courses(params) });

export const useCourse = (slug: string) =>
  useQuery({ queryKey: qk.course(slug), queryFn: () => api.course(slug) });

// ── enrollment / progress ─────────────────────────────────────────────────
export const useMyEnrollments = () =>
  useQuery({ queryKey: qk.enrollments, queryFn: api.myEnrollments });

export const useProgress = (courseId: string, enabled = true) =>
  useQuery({
    queryKey: qk.progress(courseId),
    queryFn: () => api.progress(courseId),
    enabled,
  });

export function useToggleLesson(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => api.toggleLesson(courseId, lessonId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.progress(courseId) });
      qc.invalidateQueries({ queryKey: qk.enrollments });
    },
  });
}

export function useEnrollFree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => api.enrollFree(courseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.enrollments }),
  });
}

// ── quiz ─────────────────────────────────────────────────────────────────
export const useQuiz = (lessonId: string) =>
  useQuery({ queryKey: qk.quiz(lessonId), queryFn: () => api.quiz(lessonId) });

export function useSubmitQuiz(lessonId: string, courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: QuizAttemptInput) => api.submitQuiz(lessonId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.quizResult(lessonId) });
      if (courseId) qc.invalidateQueries({ queryKey: qk.progress(courseId) });
    },
  });
}

// ── commerce ──────────────────────────────────────────────────────────────
export function useQuote() {
  return useMutation({ mutationFn: (body: CheckoutQuoteInput) => api.quote(body) });
}

export const useMyOrders = () =>
  useQuery({ queryKey: qk.orders, queryFn: api.myOrders });

// ── reviews ───────────────────────────────────────────────────────────────
export const useCourseReviews = (courseId: string, page = 1) =>
  useQuery({
    queryKey: [...qk.reviews(courseId), page],
    queryFn: () => api.courseReviews(courseId, page),
  });

export function useSubmitReview(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReviewInput) => api.submitReview(courseId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.myReview(courseId) });
      qc.invalidateQueries({ queryKey: qk.reviews(courseId) });
    },
  });
}

// ── certificates ──────────────────────────────────────────────────────────
export const useMyCertificates = () =>
  useQuery({ queryKey: qk.certificates, queryFn: api.myCertificates });

// ── admin ─────────────────────────────────────────────────────────────────
export const useAdminOverview = () =>
  useQuery({ queryKey: qk.adminOverview, queryFn: api.adminOverview });

export const useAdminStudents = (params: Record<string, string | number | undefined> = {}) =>
  useQuery({ queryKey: qk.adminStudents(params), queryFn: () => api.adminStudents(params) });

export const useAdminOrders = (params: Record<string, string | number | undefined> = {}) =>
  useQuery({ queryKey: qk.adminOrders(params), queryFn: () => api.adminOrders(params) });

export function useRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.refundOrder(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.adminOrders() }),
  });
}

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "ACTIVE" | "IDLE" | "AT_RISK" }) =>
      api.updateUserStatus(userId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.adminStudents() }),
  });
}

// ── instructor ────────────────────────────────────────────────────────────
export const useInstructorProfile = () =>
  useQuery({ queryKey: qk.instructorProfile, queryFn: api.instructorProfile });

export const useInstructorCourses = () =>
  useQuery({ queryKey: qk.instructorCourses, queryFn: api.instructorCourses });
