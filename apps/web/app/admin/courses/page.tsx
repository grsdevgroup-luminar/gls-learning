import type { Metadata } from "next";
import CoursesClient from "./page-client";

export const metadata: Metadata = { title: "Courses" };

export default function CoursesPage() {
  return <CoursesClient />;
}
