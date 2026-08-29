import { CourseBuilder } from "@/components/shared/course-builder";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create course" };

export default function NewCoursePage() {
  return <CourseBuilder />;
}
