import type { Metadata } from "next";
import SalesReferralsClient from "./page-client";

export const metadata: Metadata = { title: "Referrals" };

export default function SalesReferralsPage() {
  return <SalesReferralsClient />;
}
