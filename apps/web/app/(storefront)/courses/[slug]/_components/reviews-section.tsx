"use client";

import type { CourseDetailDto, ReviewDto } from "@skillstream/shared";
import { useStore } from "@/lib/context/store";
import { useSession } from "@/lib/api/session";
import { RatingBars } from "./rating-bars";
import { ReviewDialog } from "./review-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/shared/stars";
import { ThumbsUp } from "lucide-react";
import { compactNumber, initials, relativeDate } from "@/lib/format";

/** The review list is server-fetched (passed in as `initialReviews`) so it's
 *  part of the page's first paint; only the "is this viewer enrolled / did
 *  they already leave a review" bits genuinely need client session state. */
export function ReviewsSection({
  course,
  initialReviews,
}: {
  course: CourseDetailDto;
  initialReviews: ReviewDto[];
}) {
  const { isEnrolled, getMyReview, submitReview, mounted } = useStore();
  const { user } = useSession();

  const enrolled = isEnrolled(course.id);
  const myReview = mounted ? getMyReview(course.id) : undefined;
  const reviews: ReviewDto[] = myReview
    ? [
        {
          id: "mine",
          courseId: course.id,
          courseTitle: course.title,
          author: user?.name ?? "You",
          avatar: null,
          rating: myReview.rating,
          createdAt: myReview.date,
          title: myReview.title,
          body: myReview.body,
          status: "APPROVED",
          helpful: 0,
        },
        ...initialReviews,
      ]
    : initialReviews;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Student reviews</h2>
          <span className="flex items-center gap-1 text-sm">
            <Stars rating={course.ratingAvg} showValue size={15} />
            <span className="text-muted-foreground">
              · {compactNumber(course.reviewCount)} reviews
            </span>
          </span>
        </div>
        {enrolled && (
          <ReviewDialog courseId={course.id} existing={myReview} onSubmit={submitReview} />
        )}
      </div>
      <RatingBars reviews={reviews} rating={course.ratingAvg} />
      <div className="mt-6 space-y-5">
        {reviews.slice(0, 6).map((r) => (
          <div key={r.id} className="border-b pb-5 last:border-0">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs">{initials(r.author)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {r.author}
                  {r.id === "mine" && (
                    <Badge variant="secondary" className="text-[10px]">You</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Stars rating={r.rating} size={12} /> · {relativeDate(r.createdAt)}
                </div>
              </div>
            </div>
            <h4 className="mt-2 text-sm font-semibold">{r.title}</h4>
            {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
            <button className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ThumbsUp className="h-3.5 w-3.5" /> Helpful ({r.helpful})
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
