"use client";

import { useParams } from "next/navigation";
import { CourseBuilder } from "@/components/shared/course-builder";

export default function EditCoursePage() {
  const { id } = useParams<{ id: string }>();
  return <CourseBuilder courseId={id} />;
}
