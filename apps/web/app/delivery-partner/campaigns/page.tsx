import type { Metadata } from "next";
import PartnerCampaignsClient from "./page-client";

export const metadata: Metadata = { title: "Campaigns" };

export default function PartnerCampaignsPage() {
  return <PartnerCampaignsClient />;
}
