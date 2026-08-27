import type { Metadata } from "next";
import EditCourseClient from "./page-client";

export const metadata: Metadata = { title: "Edit course" };

export default function EditCoursePage() {
  return <EditCourseClient />;
}
