import type { Metadata } from "next";
import BillingClient from "./page-client";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return <BillingClient />;
}
