import type { Metadata } from "next";
import InstructorCoursesClient from "./page-client";

export const metadata: Metadata = { title: "My courses" };

export default function InstructorCoursesPage() {
  return <InstructorCoursesClient />;
}
