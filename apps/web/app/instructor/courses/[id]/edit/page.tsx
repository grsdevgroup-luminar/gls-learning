import type { Metadata } from "next";
import InstructorEditCourseClient from "./page-client";

export const metadata: Metadata = { title: "Edit course" };

export default function InstructorEditCoursePage() {
  return <InstructorEditCourseClient />;
}
