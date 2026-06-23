import { notFound } from "next/navigation";
import { getCourse, courses } from "@/lib/mock/courses";
import { LearnClient } from "@/components/student/learn-client";

export function generateStaticParams() {
  return courses.map((c) => ({ slug: c.slug }));
}

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();
  return <LearnClient course={course} />;
}
