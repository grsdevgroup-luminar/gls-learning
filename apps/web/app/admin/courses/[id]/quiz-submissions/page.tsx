import type { Metadata } from "next";
import QuizSubmissionsClient from "@/app/instructor/courses/[id]/quiz-submissions/page-client";

export const metadata: Metadata = { title: "Quiz submissions" };

export default function AdminQuizSubmissionsPage() {
  return <QuizSubmissionsClient admin />;
}
