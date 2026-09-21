import type { Metadata } from "next";
import PartnerMembersClient from "./page-client";

export const metadata: Metadata = { title: "Members" };

export default function PartnerMembersPage() {
  return <PartnerMembersClient />;
}
