import type {
  AuthTokensDto,
  AuthUserDto,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from "@skillstream/shared";
import { apiFetch } from "./client";

export const authApi = {
  login: (input: LoginInput) =>
    apiFetch<AuthTokensDto>("/auth/login", { method: "POST", body: input }),

  register: (input: RegisterInput) =>
    apiFetch<AuthTokensDto>("/auth/register", { method: "POST", body: input }),

  logout: () => apiFetch<{ ok: true }>("/auth/logout", { method: "POST" }),

  me: () => apiFetch<AuthUserDto>("/auth/me"),

  forgotPassword: (email: string) =>
    apiFetch<{ ok: true }>("/auth/forgot-password", { method: "POST", body: { email } }),

  resetPassword: (token: string, password: string) =>
    apiFetch<{ ok: true }>("/auth/reset-password", { method: "POST", body: { token, password } }),

  updateProfile: (input: UpdateProfileInput) =>
    apiFetch<AuthUserDto>("/auth/me/profile", { method: "PATCH", body: input }),

  changePassword: (input: ChangePasswordInput) =>
    apiFetch<{ ok: true }>("/auth/me/password", { method: "POST", body: input }),
};
