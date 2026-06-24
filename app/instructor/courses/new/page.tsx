"use client";

import { useStore } from "@/lib/context/store";
import { CourseBuilder } from "@/components/admin/course-builder";
import { ApprovalGate } from "@/components/instructor/approval-gate";

export default function NewInstructorCourse() {
  const { currentInstructor, mounted } = useStore();
  if (!mounted || !currentInstructor) return null;
  return (
    <ApprovalGate>
      <CourseBuilder mode="instructor" instructorId={currentInstructor.id} />
    </ApprovalGate>
  );
}
