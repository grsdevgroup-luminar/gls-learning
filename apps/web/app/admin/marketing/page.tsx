import type { Metadata } from "next";
import MarketingClient from "./page-client";

export const metadata: Metadata = { title: "Automation" };

export default function MarketingPage() {
  return <MarketingClient />;
}
