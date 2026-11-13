"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCheck, Clock3 } from "lucide-react";
import { instructorApi } from "@/lib/api/endpoints";
import { ApprovalGate } from "../../../_components/approval-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { relativeDate } from "@/lib/format";

export default function QuizSubmissionsClient() {
  const { id } = useParams<{ id: string }>();
  const { data: courses } = useQuery({ queryKey: ["instructor", "courses"], queryFn: instructorApi.courses });
  const { data: submissions, isLoading, error } = useQuery({
    queryKey: ["instructor", "quiz-submissions", id],
    queryFn: () => instructorApi.quizSubmissions(id),
  });
  const course = courses?.find((item) => item.id === id);

  return (
    <ApprovalGate>
      <div className="space-y-6 p-6 md:p-8">
        <Button variant="ghost" size="sm" render={<Link href="/instructor/courses" />}><ArrowLeft /> Back to courses</Button>
        <header>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Quiz/Final Exam submissions</h1>
          <p className="text-sm text-muted-foreground">{course?.title ?? "Course"} · Review written answers and final scores.</p>
        </header>
        {error && <p className="text-sm text-destructive">Failed to load quiz submissions.</p>}
        {isLoading ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading submissions…</CardContent></Card> : !submissions?.length ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No quiz submissions yet.</CardContent></Card> : (
          <div className="space-y-3">
            {submissions.map((submission) => (
              <Card key={submission.id}>
                <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{submission.studentName}</h2><StatusBadge status={submission.reviewStatus} /></div>
                    <p className="mt-1 break-words text-sm text-muted-foreground">{submission.quizTitle} · {submission.studentEmail}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{submission.pendingAnswerCount} pending of {submission.writtenAnswerCount} written answers · Submitted {relativeDate(submission.createdAt)}</p>
                  </div>
                  <Button className="shrink-0" render={<Link href={`/instructor/quiz-submissions/${submission.id}`} />}><ClipboardCheck /> Review submission</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ApprovalGate>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={status === "PENDING_REVIEW" ? "text-warning" : "text-success"}>{status === "PENDING_REVIEW" ? <><Clock3 /> Pending review</> : status === "GRADED" ? "Graded" : "Auto graded"}</Badge>;
}
