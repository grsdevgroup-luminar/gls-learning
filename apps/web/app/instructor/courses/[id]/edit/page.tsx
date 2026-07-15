"use client";

import { useParams } from "next/navigation";
import { CourseBuilder } from "@/components/admin/course-builder";
import { ApprovalGate } from "@/components/instructor/approval-gate";

export default function EditInstructorCourse() {
  const { id } = useParams<{ id: string }>();

  // Ownership is enforced server-side: the authoring detail endpoint rejects
  // courses that aren't yours, and the builder surfaces that error.
  return (
    <ApprovalGate>
      <CourseBuilder courseId={id} mode="instructor" />
    </ApprovalGate>
  );
}
