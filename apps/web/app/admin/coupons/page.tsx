import type { Metadata } from "next";
import CouponsClient from "./page-client";

export const metadata: Metadata = { title: "Coupons" };

export default function CouponsPage() {
  return <CouponsClient />;
}
