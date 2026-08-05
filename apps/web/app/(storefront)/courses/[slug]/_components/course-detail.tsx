import type { CourseDetailDto, ReviewDto } from "@skillstream/shared";
import { CourseComments } from "./course-comments";
import { CourseHero } from "./course-hero";
import { CourseCurriculum } from "./course-curriculum";
import { CoursePreviewPlayer } from "./course-preview-player";
import { CoursePurchaseCard } from "./course-purchase-card";
import { ReviewsSection } from "./reviews-section";

/** Server-rendered shell: hero, curriculum, requirements, instructor bio, and
 *  reviews are all static per request and ship as real HTML. The purchase
 *  card, preview player watermark, and review-submission dialog are the only
 *  genuinely viewer-dependent pieces — each is its own small client island. */
export function CourseDetail({
  course,
  reviews,
}: {
  course: CourseDetailDto;
  reviews: ReviewDto[];
}) {
  // Curriculum arrives a tick after the summary, so sections can still be empty.
  const previewLesson =
    course.sections.flatMap((s) => s.lessons).find((l) => l.preview) ??
    course.sections[0]?.lessons[0];

  return (
    <>
      <CourseHero course={course} />

      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10 pt-10">
          {previewLesson && (
            <CoursePreviewPlayer lesson={previewLesson} seed={course.thumbnail} />
          )}

          <CourseCurriculum course={course} />

          <ReviewsSection course={course} initialReviews={reviews} />

          <CourseComments courseId={course.id} />
        </div>

        {/* Purchase card — pulled up to overlap the hero, then sticky */}
        <div className="order-first lg:order-none lg:-mt-32">
          <CoursePurchaseCard course={course} />
        </div>
      </div>
    </>
  );
}
