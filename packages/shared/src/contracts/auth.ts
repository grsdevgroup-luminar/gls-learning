import { z } from "zod";
import { UserRole } from "../enums.js";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128);

export const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: passwordSchema,
  country: z.string().min(2).max(80).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

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
  instructorStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
}

export interface AuthTokensDto {
  accessToken: string;
  /** seconds until the access token expires */
  expiresIn: number;
}
