import { notFound } from "next/navigation";
import { getCourseById, courses } from "@/lib/mock/courses";
import { CourseBuilder } from "@/components/admin/course-builder";

export function generateStaticParams() {
  return courses.map((c) => ({ id: c.id }));
}

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = getCourseById(id);
  if (!course) notFound();
  return <CourseBuilder course={course} />;
}
