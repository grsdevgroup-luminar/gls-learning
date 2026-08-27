import type { Metadata } from "next";
import ProgressClient from "./page-client";

export const metadata: Metadata = { title: "My progress" };

export default function ProgressPage() {
  return <ProgressClient />;
}
