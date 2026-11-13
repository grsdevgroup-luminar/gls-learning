import type { Metadata } from "next";
import QuizSubmissionsClient from "./page-client";

export const metadata: Metadata = { title: "Quiz submissions" };

export default function QuizSubmissionsPage() {
  return <QuizSubmissionsClient />;
}
