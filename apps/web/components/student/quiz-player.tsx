"use client";

import { useMemo, useState } from "react";
import type { Quiz } from "@/types";
import { useStore } from "@/lib/context/store";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RotateCcw, PartyPopper, HelpCircle } from "lucide-react";
import { toast } from "sonner";

export function QuizPlayer({
  courseId,
  lessonId,
  quiz,
  onPassed,
}: {
  courseId: string;
  lessonId: string;
  quiz: Quiz;
  onPassed?: () => void;
}) {
  const { submitQuizAttempt, getQuizResult } = useStore();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [scorePercent, setScorePercent] = useState(0);

  const existing = getQuizResult(courseId, lessonId);
  const allAnswered = quiz.questions.every((q) => answers[q.id]);

  const correctCount = useMemo(
    () => quiz.questions.filter((q) => answers[q.id] === q.correctOptionId).length,
    [answers, quiz.questions],
  );

  function submit() {
    const pct = Math.round((correctCount / quiz.questions.length) * 100);
    setScorePercent(pct);
    setSubmitted(true);
    const result = submitQuizAttempt(courseId, lessonId, pct, quiz.passScore);
    if (result.lastScore >= quiz.passScore) {
      toast.success("Quiz passed!", { description: `Scored ${pct}%` });
      onPassed?.();
    } else {
      toast.error("Not quite — give it another shot", { description: `Scored ${pct}%` });
    }
  }

  function retake() {
    setAnswers({});
    setSubmitted(false);
    setScorePercent(0);
  }

  if (submitted) {
    const passed = scorePercent >= quiz.passScore;
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
          You scored {scorePercent}% ({correctCount}/{quiz.questions.length} correct) — passing
          score is {quiz.passScore}%.
        </p>

        <div className="mt-6 space-y-3 text-left">
          {quiz.questions.map((q, i) => {
            const userAnswer = answers[q.id];
            const correct = userAnswer === q.correctOptionId;
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
                    {!correct && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Correct answer: {q.options.find((o) => o.id === q.correctOptionId)?.text}
                      </p>
                    )}
                    {q.explanation && (
                      <p className="mt-1 text-xs text-muted-foreground">{q.explanation}</p>
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

      <Button className="mt-6 w-full" disabled={!allAnswered} onClick={submit}>
        Submit quiz
      </Button>
    </div>
  );
}
