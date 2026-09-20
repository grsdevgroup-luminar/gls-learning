import { z } from "zod";
import { UserRole } from "../enums.js";
import { isIsoCountryCode } from "../countries.js";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must include an uppercase letter (A–Z)")
  .regex(/[a-z]/, "Password must include a lowercase letter (a–z)")
  .regex(/[0-9]/, "Password must include a number (0–9)")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character (for example, !@#$%)")
  .max(128);

const emailFormatSchema = z.string().email("Enter a valid email address");

/**
 * Email validation shared by the browser and API.
 *
 * Do not trim here: leading/trailing whitespace is input that should be
 * rejected explicitly instead of silently changing the credential the user
 * entered.
 */
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .refine((value) => value === value.trim(), {
    message: "Email must not have leading or trailing whitespace",
  })
  .refine((value) => emailFormatSchema.safeParse(value).success, {
    message: "Enter a valid email address",
  });

/** Canonical form for a validated email before persistence or lookup. */
export function normalizeEmail(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

/** ISO 3166-1 alpha-2 code from our supported country list, uppercased for storage. */
export const countryCodeSchema = z
  .string()
  .min(1, "Country is required")
  .transform((v) => v.trim().toUpperCase())
  .pipe(
    z
      .string()
      .length(2, "Select a valid country")
      .refine(isIsoCountryCode, { message: "Select a valid country" }),
  );

export const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: emailSchema,
  password: passwordSchema,
  country: countryCodeSchema,
  // A delivery partner's referral code captured from `?ref=` at signup —
  // locked in as durable attribution (User.referredByPartnerId) if valid.
  // Silently ignored if unknown/invalid; never blocks signup.
  referralCode: z.string().trim().max(40).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const forcePasswordChangeSchema = z.object({
  newPassword: passwordSchema,
});
export type ForcePasswordChangeInput = z.infer<typeof forcePasswordChangeSchema>;

/** The authenticated user shape returned by GET /auth/me. Never includes the
 *  password hash or tokens. */
export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  country: string | null;
  /** E.164; null until the learner adds one. Required for SMS reminders. */
  phone: string | null;
  role: UserRole;
  emailVerified: boolean;
  /** True for an admin-provisioned account (temp password) that hasn't set
   *  its own password yet — the frontend must redirect to force-password-change. */
  mustChangePassword: boolean;
  instructorStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  /** Same idea as instructorStatus — lets the frontend route a pending/rejected
   *  delivery-partner applicant to /delivery-partner right after login instead
   *  of /dashboard, without a second request. */
  deliveryPartnerStatus?: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | null;
}

export interface AuthTokensDto {
  accessToken: string;
  /** seconds until the access token expires */
  expiresIn: number;
}
