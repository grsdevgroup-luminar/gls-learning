"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QuizAttemptResultDto } from "@skillstream/shared";
import { api } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RotateCcw, PartyPopper, HelpCircle, Loader2 } from "lucide-react";
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState<QuizAttemptResultDto | null>(null);

  const { data: quiz, isLoading } = useQuery({
    queryKey: ["quiz", lessonId],
    queryFn: () => api.quiz(lessonId),
  });
  const { data: existing } = useQuery({
    queryKey: ["quiz-result", lessonId],
    queryFn: () => api.quizResult(lessonId),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.submitQuiz(lessonId, {
        answers: Object.entries(answers).map(([questionId, optionId]) => ({
          questionId,
          optionId,
        })),
      }),
    onSuccess: (result) => {
      setAttempt(result);
      void qc.invalidateQueries({ queryKey: ["quiz-result", lessonId] });
      // Passing may auto-complete the lesson (and even finish the course).
      void qc.invalidateQueries({ queryKey: ["store", "enrollments"] });
      void qc.invalidateQueries({ queryKey: ["enrollments"] });
      if (result.passed) {
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
    setAttempt(null);
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

  const allAnswered = quiz.questions.every((q) => answers[q.id]);

  if (attempt) {
    const passed = attempt.passed;
    const correctCount = attempt.results.filter((r) => r.correct).length;
    const feedbackByQuestion = new Map(attempt.results.map((r) => [r.questionId, r]));
    return (
      <div className="mx-auto w-full max-w-2xl p-6 text-center">
        <div
          className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full ${
            passed ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {passed ? <PartyPopper className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
        </div>
        <h2 className="text-xl font-bold">{passed ? "You passed!" : "Almost there"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You scored {attempt.score}% ({correctCount}/{quiz.questions.length} correct) — passing
          score is {quiz.passScore}%.
        </p>

        <div className="mt-6 space-y-3 text-left">
          {quiz.questions.map((q, i) => {
            const fb = feedbackByQuestion.get(q.id);
            const correct = !!fb?.correct;
            return (
              <div key={q.id} className="rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  {correct ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {i + 1}. {q.prompt}
                    </p>
                    {!correct && fb && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Correct answer: {q.options.find((o) => o.id === fb.correctOptionId)?.text}
                      </p>
                    )}
                    {fb?.explanation && (
                      <p className="mt-1 text-xs text-muted-foreground">{fb.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Button className="mt-6" variant={passed ? "outline" : "default"} onClick={retake}>
          <RotateCcw /> Retake quiz
        </Button>
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
        {quiz.questions.map((q, i) => (
          <div key={q.id}>
            <p className="text-sm font-medium">
              {i + 1}. {q.prompt}
            </p>
            <RadioGroup
              className="mt-3"
              value={answers[q.id] ?? ""}
              onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v as string }))}
            >
              {q.options.map((o) => (
                <Label
                  key={o.id}
                  className="flex items-center gap-2.5 rounded-lg border p-3 text-sm font-normal hover:bg-secondary/40"
                >
                  <RadioGroupItem value={o.id} />
                  {o.text}
                </Label>
              ))}
            </RadioGroup>
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
