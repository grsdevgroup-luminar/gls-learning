import type { Metadata } from "next";
import PayoutsClient from "./page-client";

export const metadata: Metadata = { title: "Payouts" };

export default function PayoutsPage() {
  return <PayoutsClient />;
}
