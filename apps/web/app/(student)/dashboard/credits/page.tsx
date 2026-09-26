import type { Metadata } from "next";
import CreditsClient from "./page-client";

export const metadata: Metadata = { title: "Store credit" };

export default function CreditsPage() {
  return <CreditsClient />;
}