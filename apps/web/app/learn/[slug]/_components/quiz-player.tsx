"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QuizAttemptResultDto } from "@grslearning/shared";
import { api } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RotateCcw, PartyPopper, HelpCircle, Loader2, Clock3 } from "lucide-react";
import { toast } from "sonner";

/** Server-graded quiz: questions come without answers; grading, best-score
 *  tracking and lesson auto-completion all happen in the API. */
export function QuizPlayer({
  lessonId,
  onPassed,
}: {
  courseId?: string;
  lessonId: string;
  onPassed?: () => void;
}) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState<QuizAttemptResultDto | null>(null);
  const [showRetake, setShowRetake] = useState(false);

  const { data: quiz, isLoading } = useQuery({
    queryKey: ["quiz", lessonId],
    queryFn: () => api.quiz(lessonId),
  });
  const { data: existing } = useQuery({
    queryKey: ["quiz-result", lessonId],
    queryFn: () => api.quizResult(lessonId),
    refetchInterval: (query) => query.state.data?.reviewStatus === "PENDING_REVIEW" ? 15_000 : false,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.submitQuiz(lessonId, {
        answers: quiz!.questions.map((question) => question.questionType === "WRITTEN"
          ? { questionId: question.id, writtenAnswer: writtenAnswers[question.id] ?? "" }
          : { questionId: question.id, optionIds: answers[question.id] ?? [] }),
      }),
    onSuccess: (result) => {
      setAttempt(result);
      setShowRetake(false);
      void qc.invalidateQueries({ queryKey: ["quiz-result", lessonId] });
      // Passing may auto-complete the lesson (and even finish the course).
      void qc.invalidateQueries({ queryKey: ["enrollments"] });
      if (result.reviewStatus === "PENDING_REVIEW") {
        toast.info("Quiz submitted for review", {
          description: "Your written answer will be graded by an instructor or admin.",
        });
      } else if (result.passed) {
        toast.success("Quiz passed!", { description: `Scored ${result.score}%` });
        onPassed?.();
      } else {
        toast.error("Not quite — give it another shot", {
          description: `Scored ${result.score}%`,
        });
      }
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  function retake() {
    setAnswers({});
    setWrittenAnswers({});
    setAttempt(null);
    setShowRetake(true);
  }

  if (isLoading) {
    return (
      <div className="mx-auto grid w-full max-w-2xl place-items-center p-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quiz || quiz.questions.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6 text-center text-sm text-muted-foreground">
        This quiz has no questions yet.
      </div>
    );
  }

  const allAnswered = quiz.questions?.every((q) => q.questionType === "WRITTEN" ? !!writtenAnswers[q.id]?.trim() : (answers[q.id]?.length ?? 0) > 0) ?? false;

  const reviewedAttempt = existing?.latestAttempt;
  if (
    !showRetake &&
    reviewedAttempt?.reviewStatus === "GRADED" &&
    reviewedAttempt.writtenReviews.length > 0 &&
    (!attempt || attempt.attemptId === reviewedAttempt.id)
  ) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6">
        <div className="text-center">
          {reviewedAttempt.passed ? <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" /> : <XCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />}
          <h2 className="text-xl font-bold">{reviewedAttempt.passed ? "Quiz passed" : "Quiz reviewed"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Final score: {reviewedAttempt.score}% · Passing score: {quiz.passScore}%
          </p>
        </div>
        <div className="mt-6 space-y-3">
          {reviewedAttempt.writtenReviews.map((review) => (
            <div key={review.questionId} className="rounded-lg border p-4">
              <p className="font-medium">{review.prompt}</p>
              <p className="mt-2 text-xs text-muted-foreground">Your answer</p>
              <p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm">{review.answer}</p>
              <p className="mt-3 text-sm font-medium">Marks: {review.score ?? "Pending"}/{review.marks}</p>
              {review.feedback ? (
                <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-primary">Instructor feedback</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{review.feedback}</p>
                </div>
              ) : <p className="mt-2 text-xs text-muted-foreground">No written feedback was left for this answer.</p>}
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Button variant={reviewedAttempt.passed ? "outline" : "default"} onClick={retake}>
            <RotateCcw /> Retake quiz
          </Button>
        </div>
      </div>
    );
  }

  if (attempt) {
    const passed = attempt.passed;
    const pendingReview = attempt.reviewStatus === "PENDING_REVIEW";
    const mcqQuestions = quiz.questions.filter((q) => q.questionType === "MCQ");
    const correctCount = attempt.results?.filter((r) => r.questionType === "MCQ" && r.correct).length ?? 0;
    const feedbackByQuestion = new Map(attempt.results?.map((r) => [r.questionId, r]) ?? []);
    return (
      <div className="mx-auto w-full max-w-2xl p-6 text-center">
        <div
          className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full ${
            pendingReview ? "bg-primary/10 text-primary" : passed ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {pendingReview ? <Clock3 className="h-8 w-8" /> : passed ? <PartyPopper className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
        </div>
        <h2 className="text-xl font-bold">{pendingReview ? "Submitted for review" : passed ? "You passed!" : "Almost there"}</h2>
        {pendingReview ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {mcqQuestions.length > 0 && <>MCQ: {correctCount}/{mcqQuestions.length} correct. </>}
            Written answers are awaiting instructor or admin grading. Your final score and pass result will appear after review.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            You scored {attempt.score}%{mcqQuestions.length > 0 ? ` (${correctCount}/${mcqQuestions.length} MCQs correct)` : ""} — passing score is {quiz.passScore}%.
          </p>
        )}

        <div className="mt-6 space-y-3 text-left">
          {quiz.questions?.map((q, i) => {
            const fb = feedbackByQuestion.get(q.id);
            const correct = !!fb?.correct;
            const previous = quiz.questions[i - 1];
            const startsGroup = !!q.group && q.group.id !== previous?.group?.id;
            return (
              <div key={q.id} className="rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  {q.questionType === "WRITTEN" ? (
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : correct ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div className="flex-1">
                    {startsGroup && q.group?.label && (
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                        {q.group.label}{q.group.title ? ` · ${q.group.title}` : ""}{q.group.marks != null ? ` · ${q.group.marks} marks` : ""}
                      </p>
                    )}
                    {(q.group?.scenario || q.scenario) && (startsGroup || !q.group) && (
                      <p className="mb-2 whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs leading-relaxed text-muted-foreground">
                        {q.group?.scenario || q.scenario}
                      </p>
                    )}
                    <p className="text-sm font-medium">
                      {q.prompt}
                    </p>
                    {q.questionType === "WRITTEN" ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <span className="font-medium">Your answer · Awaiting review</span>
                        <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/50 p-2">{fb?.writtenAnswer}</p>
                      </div>
                    ) : !correct && fb && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Correct answer: {q.options
                          ?.filter((o) => fb.correctOptionIds.includes(o.id))
                          .map((o) => o.text)
                          .join(", ")}
                      </p>
                    )}
                    {q.questionType === "MCQ" && fb?.explanation && (
                      <p className="mt-1 text-xs text-muted-foreground">{fb.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!pendingReview && (
          <Button className="mt-6" variant={passed ? "outline" : "default"} onClick={retake}>
            <RotateCcw /> Retake quiz
          </Button>
        )}
      </div>
    );
  }

  if (existing?.reviewStatus === "PENDING_REVIEW") {
    return (
      <div className="mx-auto w-full max-w-2xl p-6 text-center">
        <Clock3 className="mx-auto mb-4 h-10 w-10 text-primary" />
        <h2 className="text-xl font-bold">Submitted for review</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your written answers are awaiting instructor or admin grading. Your final score and pass result will appear after review.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Badge className="mb-3 gap-1 bg-primary/10 text-primary hover:bg-primary/10">
        <HelpCircle className="h-3 w-3" /> Quiz
      </Badge>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Knowledge check</h2>
        <Badge variant="outline">{quiz.questions.length} questions · {quiz.passScore}% to pass</Badge>
      </div>
      {existing && (
        <p className="mt-1 text-xs text-muted-foreground">
          Best score so far: {existing.bestScore}% ({existing.attempts} attempt
          {existing.attempts > 1 ? "s" : ""}) {existing.passed && "— passed"}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {quiz.questions?.map((q, i) => (
          <div key={q.id}>
            {q.group?.id !== quiz.questions[i - 1]?.group?.id && q.group?.label && (
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                {q.group.label}{q.group.title ? ` · ${q.group.title}` : ""}{q.group.marks != null ? ` · ${q.group.marks} marks` : ""}
              </p>
            )}
            {(q.group?.scenario || q.scenario) && (q.group?.id !== quiz.questions[i - 1]?.group?.id || !q.group) && (
              <p className="mb-2 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground">
                {q.group?.scenario || q.scenario}
              </p>
            )}
            <p className="text-sm font-medium">
              {q.prompt}
            </p>
            {q.questionType === "WRITTEN" && (
              <div className="mt-3">
                <textarea value={q.id in writtenAnswers ? writtenAnswers[q.id] : ""} onChange={(e) => setWrittenAnswers((current) => ({ ...current, [q.id]: e.target.value }))} placeholder="Write your answer here..." className="min-h-32 w-full rounded-lg border bg-background p-3 text-sm" />
                <p className="mt-1 text-xs text-muted-foreground">{writtenAnswers[q.id]?.trim().split(/\s+/).filter(Boolean).length ?? 0} words</p>
              </div>
            )}
            {q.questionType === "MCQ" && <div className="mt-3 space-y-2">
              {q.multipleAnswers && (
                <p className="text-xs text-muted-foreground">Select all that apply.</p>
              )}
              {q.options?.map((o) => {
                const selected = answers[q.id]?.includes(o.id) ?? false;
                return (
                  <Label
                    key={o.id}
                    className="flex items-center gap-2.5 rounded-lg border p-3 text-sm font-normal hover:bg-secondary/40"
                  >
                    <input
                      type={q.multipleAnswers ? "checkbox" : "radio"}
                      name={`answer-${q.id}`}
                      checked={selected}
                      onChange={() =>
                        setAnswers((current) => {
                          const existing = current[q.id] ?? [];
                          const next = q.multipleAnswers
                            ? selected
                              ? existing.filter((id) => id !== o.id)
                              : [...existing, o.id]
                            : [o.id];
                          return { ...current, [q.id]: next };
                        })
                      }
                      className="size-4 shrink-0 accent-primary"
                    />
                    {o.text}
                  </Label>
                );
              })}
            </div>}
          </div>
        ))}
      </div>

      <Button
        className="mt-6 w-full"
        disabled={!allAnswered || submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? (
          <>
            <Loader2 className="animate-spin" /> Grading…
          </>
        ) : (
          "Submit quiz"
        )}
      </Button>
    </div>
  );
}
