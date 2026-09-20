"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./endpoints";

export const useMyDeliveryPartner = () =>
  useQuery({ queryKey: ["me", "delivery-partner"], queryFn: () => api.myDeliveryPartner() });

export const useMyPartnerApplication = (enabled = true) =>
  useQuery({
    queryKey: ["me", "delivery-partner", "application"],
    queryFn: () => api.myDeliveryPartnerApplication(),
    enabled,
  });

export const useMyPartnerReferrals = () =>
  useQuery({
    queryKey: ["me", "delivery-partner", "referrals"],
    queryFn: () => api.myDeliveryPartnerReferrals(),
  });

export const useMyPartnerCampaigns = () =>
  useQuery({
    queryKey: ["me", "delivery-partner", "campaigns"],
    queryFn: () => api.myPartnerCampaigns(),
  });

/** Referral link built from the current origin so it works in every env. */
export const referralLinkFor = (code: string) =>
  `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${code}`;
