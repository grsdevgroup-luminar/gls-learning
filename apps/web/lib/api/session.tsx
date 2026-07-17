"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  AuthUserDto,
  LoginInput,
  RegisterInput,
  UserRole,
} from "@skillstream/shared";
import { authApi } from "./auth";
import { ApiError } from "./errors";

export const SESSION_QUERY_KEY = ["session", "me"] as const;

interface SessionValue {
  user: AuthUserDto | null;
  role: UserRole | "GUEST";
  isLoading: boolean;
  isAuthenticated: boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    // No initialData: `null` counts as cached data to react-query, which (with
    // staleTime) suppressed the mount fetch entirely — every hard load rendered
    // a signed-in user as a guest until something else invalidated the key.
    staleTime: 60_000,
  });

  const user = data ?? null;
  const value: SessionValue = {
    user,
    role: user?.role ?? "GUEST",
    isLoading,
    isAuthenticated: !!user,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

// ── auth mutations ─────────────────────────────────────────────────────────
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      qc.setQueryData(SESSION_QUERY_KEY, null);
      qc.clear();
    },
  });
}
