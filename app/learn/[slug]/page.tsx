import { courses } from "@/lib/mock/courses";
import { LearnLoader } from "@/components/student/learn-loader";

export function generateStaticParams() {
  return courses.map((c) => ({ slug: c.slug }));
}

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LearnLoader slug={slug} />;
}
