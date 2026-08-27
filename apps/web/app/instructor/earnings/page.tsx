import type { Metadata } from "next";
import InstructorEarningsClient from "./page-client";

export const metadata: Metadata = { title: "Earnings" };

export default function InstructorEarningsPage() {
  return <InstructorEarningsClient />;
}
