import { CourseDetailLoader } from "@/components/storefront/course-detail-loader";

// No generateStaticParams: the catalog is database-driven and the detail is
// fetched client-side, so slugs are resolved on demand rather than baked in.
export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CourseDetailLoader slug={slug} />;
}
