import type { Metadata } from "next";
import SalesEarningsClient from "./page-client";

export const metadata: Metadata = { title: "Earnings" };

export default function SalesEarningsPage() {
  return <SalesEarningsClient />;
}
