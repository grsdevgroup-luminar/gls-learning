import type { Metadata } from "next";
import QuizSubmissionClient from "@/app/instructor/quiz-submissions/[attemptId]/page-client";

export const metadata: Metadata = { title: "Review quiz submission" };

export default function AdminQuizSubmissionPage() {
  return <QuizSubmissionClient admin />;
}
