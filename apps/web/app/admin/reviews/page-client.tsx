"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReviewStatus } from "@skillstream/shared";
import { adminApi, type ReviewDto } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { initials, relativeDate } from "@/lib/format";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import { Stars } from "@/components/shared/stars";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, EyeOff, MessageSquare, Search, Star, Flag, X } from "lucide-react";
import { toast } from "sonner";
import {
  AdminPagination,
  AdminRowsPerPage,
  ADMIN_PAGE_SIZE_OPTIONS,
} from "../_components/admin-pagination";

const STATUS_FILTERS = ["all", ...Object.values(ReviewStatus)] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_LABELS: Record<Exclude<StatusFilter, "all">, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  HIDDEN: "Hidden",
};

const RATING_FILTERS = ["all", "5", "4", "3", "2", "1"] as const;
type RatingFilter = (typeof RATING_FILTERS)[number];

export default function AdminReviews() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Deep-linked from a "new review" notification — pending reviews aren't
  // visible anywhere else until an admin acts, so this narrows the list down
  // to the exact one regardless of whatever filters are otherwise selected.
  const focusedReviewId = searchParams.get("reviewId");
  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [courseId, setCourseId] = useState("all");
  const [rating, setRating] = useState<RatingFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const { data: reviewPage, isLoading, error } = useQuery({
    queryKey: ["admin", "reviews", "list", { q, status, courseId, rating, page, pageSize, focusedReviewId }],
    queryFn: () =>
      adminApi.reviews({
        reviewId: focusedReviewId ?? undefined,
        q: focusedReviewId ? undefined : q || undefined,
        status: focusedReviewId ? undefined : status === "all" ? undefined : status,
        courseId: focusedReviewId ? undefined : courseId === "all" ? undefined : courseId,
        rating: focusedReviewId ? undefined : rating === "all" ? undefined : Number(rating),
        page: focusedReviewId ? 1 : page,
        pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: statsData } = useQuery({
    queryKey: ["admin", "reviews", "stats"],
    queryFn: adminApi.reviewStats,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["admin", "reviews", "courses"],
    queryFn: adminApi.reviewCourses,
  });

  const setStatusMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "APPROVE" | "HIDE" | "UNHIDE" }) =>
      adminApi.updateReviewStatus(id, action),
    onMutate: async ({ id, action }) => {
      await qc.cancelQueries({ queryKey: ["admin", "reviews", "list"] });
      const snapshots = qc.getQueriesData<{ items: ReviewDto[] }>({
        queryKey: ["admin", "reviews", "list"],
      });

      // Update the visible row immediately. Unhide optimistically returns to
      // PENDING; the server response below corrects this for previously
      // approved reviews.
      qc.setQueriesData<{ items: ReviewDto[] }>(
        { queryKey: ["admin", "reviews", "list"] },
        (current) => {
          if (!current) return current;
          return {
            ...current,
            items: current.items.map((review) =>
              review.id === id
                ? { ...review, status: action === "UNHIDE" ? "PENDING" : action === "HIDE" ? "HIDDEN" : "APPROVED" }
                : review,
            ),
          };
        },
      );

      return { snapshots };
    },
    onSuccess: (review, { id, action }) => {
      // Replace the optimistic row with the authoritative API response.
      qc.setQueriesData<{ items: ReviewDto[] }>(
        { queryKey: ["admin", "reviews", "list"] },
        (current) => {
          if (!current) return current;
          return {
            ...current,
            items: current.items.map((item) => (item.id === id ? review : item)),
          };
        },
      );
      void qc.invalidateQueries({ queryKey: ["admin", "reviews", "stats"] });
      localStorage.setItem(
        "review-status-updated",
        JSON.stringify({ reviewId: id, timestamp: Date.now() }),
      );
      toast.success(
        action === "UNHIDE" ? "Review unhidden" : action === "APPROVE" ? "Review approved" : "Review hidden",
      );
    },
    onError: (e, _variables, context) => {
      context?.snapshots.forEach(([queryKey, data]) => {
        qc.setQueryData(queryKey, data);
      });
      toast.error(getApiErrorMessage(e));
    },
  });

  const reviews = reviewPage?.items ?? [];
  const totalPages = reviewPage?.totalPages ?? 1;

  useEffect(() => {
    if (reviewPage && page > reviewPage.totalPages) setPage(reviewPage.totalPages);
  }, [reviewPage, page]);

  const stats = statsData
    ? [
        { icon: Star, label: "Avg. rating", value: statsData.avgRating.toFixed(2) },
        { icon: MessageSquare, label: "Approved reviews", value: statsData.approved },
        { icon: Flag, label: "Pending moderation", value: statsData.pending },
      ]
    : [];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground">Moderate feedback from your students.</p>
      </div>

      {focusedReviewId && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2 text-sm">
          <span>Showing the review from your notification.</span>
          <Button size="sm" variant="ghost" onClick={() => router.push("/admin/reviews")}>
            <X /> Clear filter
          </Button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {(stats.length ? stats : [
          { icon: Star, label: "Avg. rating", value: "…" },
          { icon: MessageSquare, label: "Approved reviews", value: "…" },
          { icon: Flag, label: "Pending moderation", value: "…" },
        ]).map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search title, body, author, course…"
            className="search-input border-input bg-background pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            if (!value) return;
            setStatus(value as StatusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[11.5rem]" aria-label="Filter by status">
            <SelectValue>
              {status === "all" ? "All statuses" : STATUS_LABELS[status]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All statuses" : STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={courseId}
          onValueChange={(value) => {
            if (!value) return;
            setCourseId(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[14rem]" aria-label="Filter by course">
            <SelectValue>
              {courseId === "all"
                ? "All courses"
                : courses.find((c) => c.id === courseId)?.title ?? "All courses"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={rating}
          onValueChange={(value) => {
            if (!value) return;
            setRating(value as RatingFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[10.5rem]" aria-label="Filter by rating">
            <SelectValue>
              {rating === "all" ? "All ratings" : `${rating} star${rating === "1" ? "" : "s"}`}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RATING_FILTERS.map((r) => (
              <SelectItem key={r} value={r}>
                {r === "all" ? "All ratings" : `${r} star${r === "1" ? "" : "s"}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="sm:ml-auto">
          <AdminRowsPerPage
            value={pageSize}
            onChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">Failed to load reviews.</p>
      )}

      {isLoading && !reviewPage && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading reviews…
          </CardContent>
        </Card>
      )}

      {!isLoading && reviews.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No reviews match these filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card
              key={r.id}
              className={r.status === "PENDING" ? "border-warning/30" : undefined}
            >
              <CardContent className="pt-6">
                <ReviewBody r={r} />
                <div className="mt-3 flex gap-2">
                  {r.status !== "APPROVED" && (
                    <Button
                      size="sm"
                      disabled={setStatusMut.isPending}
                      onClick={() => setStatusMut.mutate({ id: r.id, action: r.status === "HIDDEN" ? "UNHIDE" : "APPROVE" })}
                    >
                      <Check /> {r.status === "HIDDEN" ? "Unhide" : "Approve"}
                    </Button>
                  )}
                  {r.status !== "HIDDEN" && (
                    <Button
                      size="sm"
                      variant={r.status === "APPROVED" ? "ghost" : "outline"}
                      disabled={setStatusMut.isPending}
                      onClick={() => setStatusMut.mutate({ id: r.id, action: "HIDE" })}
                    >
                      <EyeOff /> Hide
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AdminPagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        total={reviewPage?.total}
        itemLabel="review"
      />
    </div>
  );
}

function ReviewBody({ r }: { r: ReviewDto }) {
  return (
    <div>
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
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="text-xs">{r.courseTitle}</Badge>
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
      </div>
      {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
    </div>
  );
}
