"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/context/store";
import { CourseBuilder } from "@/components/admin/course-builder";
import { ApprovalGate } from "@/components/instructor/approval-gate";
import { Button } from "@/components/ui/button";

export default function EditInstructorCourse() {
  const { id } = useParams<{ id: string }>();
  const { getCourse, currentInstructor, mounted } = useStore();

  if (!mounted || !currentInstructor) return null;

  const course = getCourse(id);
  // Only the owning instructor may edit their own course.
  if (!course || course.instructorId !== currentInstructor.id) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="font-medium">Course not found</p>
        <p className="mt-1 text-sm text-muted-foreground">This course doesn&apos;t exist or isn&apos;t one of yours.</p>
        <Button className="mt-4" variant="outline" render={<Link href="/instructor/courses" />}>Back to my courses</Button>
      </div>
    );
  }

  return (
    <ApprovalGate>
      <CourseBuilder course={course} mode="instructor" instructorId={currentInstructor.id} />
    </ApprovalGate>
  );
}
