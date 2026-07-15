"use client";

import { CourseBuilder } from "@/components/admin/course-builder";
import { ApprovalGate } from "@/components/instructor/approval-gate";

export default function NewInstructorCourse() {
  return (
    <ApprovalGate>
      <CourseBuilder mode="instructor" />
    </ApprovalGate>
  );
}
