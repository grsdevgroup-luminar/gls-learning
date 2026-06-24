"use client";

import { useParams } from "next/navigation";
import { useStore } from "@/lib/context/store";
import { CourseBuilder } from "@/components/admin/course-builder";

export default function EditCoursePage() {
  const { id } = useParams<{ id: string }>();
  const { getCourse, mounted } = useStore();

  if (!mounted) return null;

  const course = getCourse(id);
  if (!course) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-muted-foreground">Course not found.</p>
      </div>
    );
  }

  return <CourseBuilder course={course} />;
}
