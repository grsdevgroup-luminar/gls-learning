import type { Metadata } from "next";
import PricingClient from "./page-client";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return <PricingClient />;
}
