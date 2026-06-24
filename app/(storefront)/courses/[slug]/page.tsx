import { courses } from "@/lib/mock/courses";
import { CourseDetailLoader } from "@/components/storefront/course-detail-loader";

export function generateStaticParams() {
  return courses.map((c) => ({ slug: c.slug }));
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CourseDetailLoader slug={slug} />;
}
