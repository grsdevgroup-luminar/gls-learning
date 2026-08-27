import type { Metadata } from "next";
import InstructorsClient from "./page-client";

export const metadata: Metadata = { title: "Instructors" };

export default function InstructorsPage() {
  return <InstructorsClient />;
}
