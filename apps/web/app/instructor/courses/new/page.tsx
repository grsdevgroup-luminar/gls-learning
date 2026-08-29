import type { Metadata } from "next";
import InstructorNewCourseClient from "./page-client";

export const metadata: Metadata = { title: "Create course" };

export default function InstructorNewCoursePage() {
  return <InstructorNewCourseClient />;
}
