import { notFound } from "next/navigation";
import { getCourse, courses } from "@/lib/mock/courses";
import { CourseDetail } from "@/components/storefront/course-detail";

export function generateStaticParams() {
  return courses.map((c) => ({ slug: c.slug }));
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();
  return <CourseDetail course={course} />;
}
