"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./endpoints";

export const useMySalesAgent = () =>
  useQuery({ queryKey: ["me", "sales-agent"], queryFn: () => api.mySalesAgent() });

export const useMyAgentReferrals = () =>
  useQuery({
    queryKey: ["me", "sales-agent", "referrals"],
    queryFn: () => api.mySalesAgentReferrals(),
  });

/** Referral link built from the current origin so it works in every env. */
export const referralLinkFor = (code: string) =>
  `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${code}`;
