import type { Metadata } from "next";
import TeamClient from "./page-client";

export const metadata: Metadata = { title: "Team courses" };

export default function TeamPage() {
  return <TeamClient />;
}
