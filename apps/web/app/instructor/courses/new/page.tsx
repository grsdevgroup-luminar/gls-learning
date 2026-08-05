"use client";

import { CourseBuilder } from "@/components/shared/course-builder";
import { ApprovalGate } from "../../_components/approval-gate";

export default function NewInstructorCourse() {
  return (
    <ApprovalGate>
      <CourseBuilder mode="instructor" />
    </ApprovalGate>
  );
}
