"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ReviewDto } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { initials, relativeDate } from "@/lib/format";
import { Stars } from "@/components/shared/stars";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, EyeOff, MessageSquare, Star, Flag } from "lucide-react";
import { toast } from "sonner";

export default function AdminReviews() {
  const qc = useQueryClient();
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: () => api.adminReviews(),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "APPROVED" | "HIDDEN" }) =>
      api.updateReviewStatus(id, status),
    onSuccess: (_r, { status }) => {
      qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
      toast.success(status === "APPROVED" ? "Review approved" : "Review hidden");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const pending = reviews.filter((r) => r.status === "PENDING");
  const approved = reviews.filter((r) => r.status === "APPROVED");
  const avg = approved.length
    ? approved.reduce((s, r) => s + r.rating, 0) / approved.length
    : 0;

  const stats = [
    { icon: Star, label: "Avg. rating", value: avg.toFixed(2) },
    { icon: MessageSquare, label: "Approved reviews", value: approved.length },
    { icon: Flag, label: "Pending moderation", value: pending.length },
  ];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground">Moderate feedback from your students.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><s.icon className="h-5 w-5" /></div>
              <div><div className="text-2xl font-bold leading-none">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading reviews…</CardContent></Card>
      )}

      {pending.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            Pending moderation <Badge className="bg-warning text-warning-foreground hover:bg-warning">{pending.length}</Badge>
          </h2>
          <div className="space-y-3">
            {pending.map((r) => (
              <Card key={r.id} className="border-warning/30">
                <CardContent className="pt-6">
                  <ReviewBody r={r} />
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: r.id, status: "APPROVED" })}
                    >
                      <Check /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: r.id, status: "HIDDEN" })}
                    >
                      <EyeOff /> Hide
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold">Published reviews</h2>
        {!isLoading && approved.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No approved reviews yet.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {approved.slice(0, 12).map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-6">
                  <ReviewBody r={r} />
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: r.id, status: "HIDDEN" })}
                    >
                      <EyeOff /> Hide
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewBody({ r }: { r: ReviewDto }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9"><AvatarFallback className="text-xs">{initials(r.author)}</AvatarFallback></Avatar>
          <div>
            <div className="text-sm font-medium">{r.author}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Stars rating={r.rating} size={11} /> · {relativeDate(r.createdAt)}</div>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">{r.courseTitle}</Badge>
      </div>
      <h4 className="mt-2 text-sm font-semibold">{r.title}</h4>
      {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
    </div>
  );
}
