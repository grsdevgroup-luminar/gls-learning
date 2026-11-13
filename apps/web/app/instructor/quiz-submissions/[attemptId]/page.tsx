import type { Metadata } from "next";
import QuizSubmissionClient from "./page-client";

export const metadata: Metadata = { title: "Review quiz submission" };

export default function QuizSubmissionPage() {
  return <QuizSubmissionClient />;
}
