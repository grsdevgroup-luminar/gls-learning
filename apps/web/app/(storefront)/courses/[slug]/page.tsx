import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CourseDetailDto, Paginated, ReviewDto } from "@skillstream/shared";
import { serverApiCached, serverApiCachedOptional } from "@/lib/api/server";
import { CourseDetail } from "./_components/course-detail";

// Course pages are public and change infrequently (price/curriculum edits,
// not per-request) — on-demand ISR: generated on first visit, cached, and
// silently regenerated in the background at most once a minute.
//
// Known limitation (verified against a production build, not just dev):
// because this segment has no generateStaticParams (dynamicParams defaults
// to true — deliberate, so newly-published courses resolve without a full
// rebuild), notFound() here renders not-found.tsx with a `noindex` meta tag
// but an HTTP 200 status rather than a true 404 — a documented Next.js App
// Router gap for on-demand dynamic segments. The noindex tag still keeps the
// page out of search results; only the status code itself is affected. Fully
// fixing the status would require generateStaticParams + dynamicParams=false,
// which trades this away for "new courses need a rebuild to resolve" — the
// tradeoff was deliberately not taken here.
export const revalidate = 60;

async function fetchCourse(slug: string) {
  return serverApiCachedOptional<CourseDetailDto>(`/courses/${slug}`, revalidate);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dto = await fetchCourse(slug);
  if (!dto) return { title: "Course not found | SkillStream" };

  return {
    title: `${dto.title} | SkillStream`,
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
  ).catch(() => null);

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
    provider: { "@type": "Organization", name: "SkillStream" },
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
