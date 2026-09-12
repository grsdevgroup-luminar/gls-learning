"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ReviewStatus } from "@skillstream/shared";
import { instructorApi, type ReviewDto } from "@/lib/api/endpoints";
import { initials, relativeDate } from "@/lib/format";
import { Stars } from "@/components/shared/stars";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft } from "lucide-react";
import { ApprovalGate } from "../../../_components/approval-gate";

const STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: "Pending approval",
  APPROVED: "Approved",
  HIDDEN: "Hidden",
};

export default function InstructorCourseReviews() {
  const { id } = useParams<{ id: string }>();

  const { data: courses } = useQuery({
    queryKey: ["instructor", "courses"],
    queryFn: instructorApi.courses,
  });
  const course = courses?.find((c) => c.id === id);

  // Ownership is enforced server-side — the endpoint rejects courses that
  // aren't yours, same as the course builder.
  const { data: reviewPage, isLoading, error } = useQuery({
    queryKey: ["instructor", "course-reviews", id],
    queryFn: () => instructorApi.courseReviews(id, { page: 1, pageSize: 50 }),
  });
  const reviews = reviewPage?.items ?? [];

  return (
    <ApprovalGate>
      <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
        <div>
          <Button variant="ghost" size="sm" render={<Link href={`/instructor/courses/${id}/edit`} />}>
            <ArrowLeft /> Back to course
          </Button>
        </div>

        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {course ? course.title : "Course"} reviews
          </h1>
          <p className="text-sm text-muted-foreground">
            Your own preview — pending reviews are only visible to you and admins until approved.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">Failed to load reviews.</p>}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="space-y-2 pt-6">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No reviews yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <ReviewRow key={r.id} r={r} />
            ))}
          </div>
        )}
      </div>
    </ApprovalGate>
  );
}

function ReviewRow({ r }: { r: ReviewDto }) {
  return (
    <Card className={r.status === "PENDING" ? "border-warning/30" : undefined}>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs">{initials(r.author)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-medium">{r.author}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Stars rating={r.rating} size={11} /> · {relativeDate(r.createdAt)}
              </div>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              r.status === "PENDING"
                ? "text-xs text-warning"
                : r.status === "HIDDEN"
                  ? "text-xs text-muted-foreground"
                  : "text-xs text-success"
            }
          >
            {STATUS_LABELS[r.status]}
          </Badge>
        </div>
        {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
      </CardContent>
    </Card>
  );
}
