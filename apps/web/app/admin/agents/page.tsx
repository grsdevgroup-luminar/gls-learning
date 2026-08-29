import type { Metadata } from "next";
import AgentsClient from "./page-client";

export const metadata: Metadata = { title: "Sales agents" };

export default function AgentsPage() {
  return <AgentsClient />;
}
