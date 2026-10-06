"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import type { CourseDetailDto, ReviewDto } from "@skillstream/shared";
import { useStore } from "@/lib/context/store";
import { useSession } from "@/lib/api/session";
import { api } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { RatingBars } from "./rating-bars";
import { ReviewDialog } from "./review-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/shared/stars";
import { ThumbsUp } from "lucide-react";
import { compactNumber, initials, relativeDate } from "@/lib/format";
import { toast } from "sonner";

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
  const router = useRouter();
  const { isEnrolled, getMyReview, submitReview, mounted } = useStore();
  const { user } = useSession();
  const [helpfulState, setHelpfulState] = useState<Record<string, { count: number; voted: boolean }>>({});
  const helpfulVote = useMutation({
    mutationFn: (reviewId: string) => api.markReviewHelpful(reviewId),
    onSuccess: (result, reviewId) => {
      setHelpfulState((current) => ({
        ...current,
        [reviewId]: { count: result.helpful, voted: result.helpfulByMe },
      }));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  useEffect(() => {
    function handleReviewUpdate(event: StorageEvent) {
      if (event.key === "review-status-updated") router.refresh();
    }

    window.addEventListener("storage", handleReviewUpdate);
    return () => window.removeEventListener("storage", handleReviewUpdate);
  }, [router]);

  const enrolled = isEnrolled(course.id);
  const myReview = mounted ? getMyReview(course.id) : undefined;
  const reviews: ReviewDto[] =
    myReview?.status === "APPROVED"
      ? [
          {
            // Synthetic key prevents a collision with the same review in the public list.
            id: "mine:" + (myReview.id ?? course.id),
            courseId: course.id,
            courseTitle: course.title,
            author: user?.name ?? "You",
            avatar: null,
            rating: myReview.rating,
            createdAt: myReview.date,
            body: myReview.body,
            status: "APPROVED",
            helpful: 0,
            progressPercent: myReview.progressPercent,
            ratingStage: myReview.ratingStage,
            ratingWeight: myReview.ratingWeight,
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
              · {compactNumber(course.reviewCount)} verified ratings
            </span>
          </span>
        </div>
        <div id="write-a-review" className="scroll-mt-24">
          {myReview?.status === "PENDING" && (
            <p className="mb-2 text-xs text-muted-foreground">
              Your review is awaiting approval. It will appear publicly after moderation.
            </p>
          )}
          {enrolled && (
            <ReviewDialog
              courseId={course.id}
              existing={myReview ?? undefined}
              onSubmit={submitReview}
            />
          )}
        </div>
      </div>
      <RatingBars reviews={reviews} rating={course.ratingAvg} completedReviewCount={course.completedReviewCount ?? 0} />
      <div className="mt-6 space-y-5">
        {reviews?.slice(0, 6).map((r) => (
          <div key={r.id} className="border-b pb-5 last:border-0">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs">{initials(r.author)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {r.author}
                  {r.ratingStage === "COMPLETED" && (
                    <Badge variant="outline" className="text-[10px]">Course completed</Badge>
                  )}
                  {r.ratingStage === "IN_PROGRESS" && (
                    <Badge variant="outline" className="text-[10px]">Active learner</Badge>
                  )}
                  {r.ratingStage === "STARTED" && (
                    <Badge variant="outline" className="text-[10px]">Early learner</Badge>
                  )}
                  {r.id.startsWith("mine:") && (
                    <Badge variant="secondary" className="text-[10px]">You</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Stars rating={r.rating} size={12} /> · {relativeDate(r.createdAt)}
                </div>
              </div>
            </div>
            {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
            <button
              type="button"
              disabled={
                r.id.startsWith("mine:") ||
                (!!myReview?.id && r.id === myReview.id) ||
                r.helpfulByMe === true ||
                helpfulState[r.id]?.voted ||
                (helpfulVote.isPending && helpfulVote.variables === r.id)
              }
              onClick={() => {
                if (!user) {
                  toast.info("Log in to mark a review helpful.");
                  return;
                }
                helpfulVote.mutate(r.id);
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-70"
              aria-pressed={r.helpfulByMe === true || helpfulState[r.id]?.voted === true}
            >
              <ThumbsUp className="h-3.5 w-3.5" /> Helpful ({helpfulState[r.id]?.count ?? r.helpful})
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
