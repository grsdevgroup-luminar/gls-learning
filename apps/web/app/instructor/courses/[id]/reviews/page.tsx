import type { Metadata } from "next";
import InstructorCourseReviewsClient from "./page-client";

export const metadata: Metadata = { title: "Course reviews" };

export default function InstructorCourseReviewsPage() {
  return <InstructorCourseReviewsClient />;
}
