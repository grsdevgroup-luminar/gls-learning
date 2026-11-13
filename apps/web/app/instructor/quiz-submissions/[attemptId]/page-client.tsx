"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { instructorApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { ApprovalGate } from "../../_components/approval-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function QuizSubmissionClient() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const qc = useQueryClient();
  const { data: submission, isLoading, error } = useQuery({ queryKey: ["instructor", "quiz-submission", attemptId], queryFn: () => instructorApi.quizSubmission(attemptId) });
  const gradeMutation = useMutation({
    mutationFn: ({ answerId, score, feedback }: { answerId: string; score: number; feedback?: string }) => instructorApi.gradeWrittenAnswer(attemptId, answerId, { score, feedback }),
    onSuccess: (updated) => { qc.setQueryData(["instructor", "quiz-submission", attemptId], updated); void qc.invalidateQueries({ queryKey: ["instructor", "quiz-submissions", updated.courseId] }); toast.success("Answer grade saved"); },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return <ApprovalGate><div className="space-y-6 p-6 md:p-8">
    <Button variant="ghost" size="sm" render={<Link href={submission ? `/instructor/courses/${submission.courseId}/quiz-submissions` : "/instructor/courses"} />}><ArrowLeft /> Back to submissions</Button>
    {isLoading ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading submission…</CardContent></Card> : error || !submission ? <p className="text-sm text-destructive">Failed to load this submission.</p> : <>
      <header><h1 className="font-heading text-2xl font-bold tracking-tight">Review submission</h1><p className="text-sm text-muted-foreground">{submission.studentName} · {submission.quizTitle}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">Current score: {submission.score}%</Badge><Badge variant="outline">{submission.reviewStatus === "PENDING_REVIEW" ? "Pending review" : "Graded"}</Badge></div></header>
      <div className="space-y-4">{submission.answers.map((answer, index) => <AnswerCard key={answer.id} answer={answer} index={index} pending={gradeMutation.isPending} onSave={(score, feedback) => gradeMutation.mutate({ answerId: answer.id, score, feedback })} />)}</div>
    </>}
  </div></ApprovalGate>;
}

function AnswerCard({ answer, index, pending, onSave }: { answer: { id: string; prompt: string; marks: number; studentAnswer: string; score: number | null; feedback: string | null; status: string }; index: number; pending: boolean; onSave: (score: number, feedback: string) => void }) {
  const [score, setScore] = useState(answer.score?.toString() ?? "");
  const [feedback, setFeedback] = useState(answer.feedback ?? "");
  return <Card><CardContent className="space-y-4 pt-6"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Question {index + 1}</p><Badge variant="outline">Maximum {answer.marks} marks</Badge></div><p className="text-sm font-medium">{answer.prompt}</p><div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{answer.studentAnswer}</div><div className="grid gap-3 sm:grid-cols-[8rem_1fr]"><Input type="number" min={0} max={answer.marks} value={score} onChange={(e) => setScore(e.target.value)} placeholder="Score" /><Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback (optional)" className="min-h-20" /></div><Button disabled={pending || score === ""} onClick={() => onSave(Math.min(answer.marks, Math.max(0, Number(score))), feedback)}>{pending ? <><Loader2 className="animate-spin" /> Saving…</> : <><CheckCircle2 /> Save grade</>}</Button></CardContent></Card>;
}
