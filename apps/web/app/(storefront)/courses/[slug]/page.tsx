import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type {
  CourseDetailDto,
  Paginated,
  ReviewDto,
} from "@grslearning/shared";
import { serverApiOptional, serverApiCached } from "@/lib/api/server";
import { CourseDetail } from "./_components/course-detail";

// Course details are fetched per request so authenticated organization members can
// open private courses assigned to their organization. Public review data is
// still cached independently below.
export const revalidate = 60;

async function fetchCourse(slug: string) {
  return serverApiOptional<CourseDetailDto>("/courses/" + slug);
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dto = await fetchCourse(slug);
  if (!dto) return { title: "Course not found | GRS Learning" };

  return {
    title: `${dto.title} | GRS Learning`,
    description: dto.subtitle,
    openGraph: {
      title: dto.title,
      description: dto.subtitle,
      type: "website",
    },
  };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dto = await fetchCourse(slug);
  if (!dto) notFound();

  const reviewPage = await serverApiCached<Paginated<ReviewDto>>(
    `/courses/${dto.id}/reviews`,
    revalidate,
    {},
    ["course-reviews"],
  );

  const reviews = reviewPage?.items ?? [];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd(dto)) }}
      />
      <CourseDetail course={dto} reviews={reviews} />
    </>
  );
}

function courseJsonLd(dto: CourseDetailDto) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: dto.title,
    description: dto.description || dto.subtitle,
    provider: { "@type": "Organization", name: "GRS Learning" },
    ...(dto.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: dto.ratingAvg,
            reviewCount: dto.reviewCount,
          },
        }
      : {}),
  };
}
